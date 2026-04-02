import { type Either, err, ok } from "./either.js";
import { FetchError, TimeoutError, type ExecutableHandler } from "./core.js";

export interface HttpProgressEvent {
  loaded: number;
  total?: number;
  lengthComputable: boolean;
}

export interface HttpObserver {
  onprogress?: (event: HttpProgressEvent) => void;
}

export interface ProgressRequestInit extends RequestInit {
  observer?: (
    requestObserver: HttpObserver,
    responseObserver: HttpObserver,
  ) => void;
}

export type XhrError = FetchError | TimeoutError;

export type XhrResult = Either<XhrError, Response>;

/**
 * Creates a browser-only HTTP handler backed by `XMLHttpRequest`.
 *
 * It mirrors the proposed fetch `observer(...)` API while still returning
 * standard `Response` objects for downstream decoders and validators.
 *
 * @example
 * ```ts
 * import { createXhrHandler } from "@jamx/http";
 *
 * const xhr = createXhrHandler();
 *
 * const result = await xhr("https://example.com/upload", {
 *   body: file,
 *   method: "POST",
 *   observer(requestObserver, responseObserver) {
 *     requestObserver.onprogress = (event) => {
 *       console.log("upload", event.loaded, event.total);
 *     };
 *
 *     responseObserver.onprogress = (event) => {
 *       console.log("download", event.loaded, event.total);
 *     };
 *   },
 * });
 * ```
 */
export const createXhrHandler = (): ExecutableHandler<
  XhrResult,
  ProgressRequestInit
> => {
  const execute = async (
    input: RequestInfo | URL,
    init?: ProgressRequestInit,
  ): Promise<XhrResult> => {
    const XMLHttpRequestCtor = globalThis.XMLHttpRequest;

    if (!XMLHttpRequestCtor) {
      return err(
        new FetchError("XMLHttpRequest is not available in this environment."),
      );
    }

    const request = new Request(input, init);
    const requestObserver: HttpObserver = {};
    const responseObserver: HttpObserver = {};

    init?.observer?.(requestObserver, responseObserver);

    try {
      const response = await sendRequest(
        new XMLHttpRequestCtor(),
        request,
        requestObserver,
        responseObserver,
      );

      return ok(response);
    } catch (error) {
      return err(normalizeXhrError(error));
    }
  };

  return execute as ExecutableHandler<XhrResult, ProgressRequestInit>;
};

const sendRequest = async (
  xhr: XMLHttpRequest,
  request: Request,
  requestObserver: HttpObserver,
  responseObserver: HttpObserver,
): Promise<Response> => {
  const body = await getRequestBody(request);

  return new Promise<Response>((resolve, reject) => {
    const cleanup = wireAbortSignal(xhr, request.signal, reject);

    xhr.open(request.method, request.url, true);
    xhr.responseType = "arraybuffer";
    xhr.withCredentials = request.credentials === "include";

    request.headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      requestObserver.onprogress?.(toProgressEvent(event));
    };

    xhr.onprogress = (event) => {
      responseObserver.onprogress?.(toProgressEvent(event));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new FetchError("XMLHttpRequest failed."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new FetchError("Fetch request was aborted."));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new TimeoutError(xhr.timeout));
    };

    xhr.onload = () => {
      cleanup();
      resolve(toResponse(xhr));
    };

    xhr.send(body);
  });
};

const getRequestBody = async (
  request: Request,
): Promise<XMLHttpRequestBodyInit | Document | null | undefined> => {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  if (request.body === null) {
    return null;
  }

  return request.arrayBuffer();
};

const wireAbortSignal = (
  xhr: XMLHttpRequest,
  signal: AbortSignal | null,
  reject: (reason?: unknown) => void,
): (() => void) => {
  if (!signal) {
    return () => {};
  }

  if (signal.aborted) {
    xhr.abort();
    reject(
      signal.reason instanceof Error
        ? signal.reason
        : new FetchError("Fetch request was aborted.", signal.reason),
    );

    return () => {};
  }

  const abort = () => {
    xhr.abort();
  };

  signal.addEventListener("abort", abort, { once: true });

  return () => {
    signal.removeEventListener("abort", abort);
  };
};

const toResponse = (xhr: XMLHttpRequest): Response => {
  const headers = new Headers();

  for (const line of xhr
    .getAllResponseHeaders()
    .trim()
    .split(/[\r\n]+/)) {
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    headers.append(key, value);
  }

  const body =
    xhr.response instanceof ArrayBuffer ? xhr.response : new ArrayBuffer(0);

  return new Response(body.byteLength > 0 ? body : null, {
    headers,
    status: xhr.status,
    statusText: xhr.statusText,
  });
};

const toProgressEvent = (
  event: ProgressEvent<EventTarget>,
): HttpProgressEvent => {
  return {
    lengthComputable: event.lengthComputable,
    loaded: event.loaded,
    total: event.lengthComputable ? event.total : undefined,
  };
};

const normalizeXhrError = (error: unknown): XhrError => {
  if (error instanceof TimeoutError) {
    return error;
  }

  if (error instanceof FetchError) {
    return error;
  }

  if (error instanceof Error) {
    return new FetchError(error.message, error);
  }

  if (typeof error === "string") {
    return new FetchError(error, error);
  }

  return new FetchError("XMLHttpRequest failed.", error);
};
