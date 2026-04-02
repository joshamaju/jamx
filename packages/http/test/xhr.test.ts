import { afterEach, assert, describe, it } from "vitest";

// @ts-expect-error
import NodeXMLHttpRequest from "xhr2";

import {
  composeInterceptors,
  createXhrHandler,
  expectStatus,
  isErr,
  isOk,
  text,
  TimeoutError,
  withHeaders,
  type HttpProgressEvent,
} from "../src/index.js";

interface MockXhrScenario {
  onSend?: (
    xhr: MockXMLHttpRequest,
    body: Document | XMLHttpRequestBodyInit | null | undefined,
  ) => void;
  responseHeaders?: string;
}

class MockXMLHttpRequest {
  static scenario: MockXhrScenario = {};

  readonly upload: {
    onprogress: ((event: HttpProgressEvent) => void) | null;
  } = {
    onprogress: null,
  };

  method = "GET";
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  onprogress: ((event: HttpProgressEvent) => void) | null = null;
  ontimeout: (() => void) | null = null;
  response: ArrayBuffer | null = null;
  responseType = "";
  status = 0;
  statusText = "";
  timeout = 0;
  url = "";
  withCredentials = false;

  private readonly requestHeaders = new Headers();

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders.set(name, value);
  }

  getAllResponseHeaders(): string {
    return MockXMLHttpRequest.scenario.responseHeaders ?? "";
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    MockXMLHttpRequest.scenario.onSend?.(this, body);
  }

  abort() {
    this.onabort?.();
  }

  complete(options: {
    body?: string;
    headers?: string;
    status: number;
    statusText?: string;
  }) {
    this.status = options.status;
    this.statusText = options.statusText ?? "";
    this.response =
      options.body === undefined
        ? new ArrayBuffer(0)
        : new TextEncoder().encode(options.body).buffer;

    MockXMLHttpRequest.scenario.responseHeaders = options.headers ?? "";
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }

  timeoutRequest() {
    this.ontimeout?.();
  }

  getHeader(name: string) {
    return this.requestHeaders.get(name);
  }

  emitUploadProgress(event: HttpProgressEvent) {
    this.upload.onprogress?.(event);
  }

  emitDownloadProgress(event: HttpProgressEvent) {
    this.onprogress?.(event);
  }
}

const OriginalXMLHttpRequest = globalThis.XMLHttpRequest;

afterEach(() => {
  MockXMLHttpRequest.scenario = {};
  globalThis.XMLHttpRequest = OriginalXMLHttpRequest;
});

describe("createXhrHandler", () => {
  it("wraps successful responses as ok results", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    MockXMLHttpRequest.scenario = {
      onSend(xhr) {
        xhr.complete({
          body: '{"ok":true}',
          headers: "content-type: application/json\r\nx-source: xhr",
          status: 200,
          statusText: "OK",
        });
      },
    };

    const handler = createXhrHandler();
    const result = await handler("https://example.com/users");

    assert.equal(isOk(result), true);

    if (!isOk(result)) {
      throw new Error("Expected XHR handler to return an ok result.");
    }

    assert.equal(result.value.status, 200);
    assert.equal(result.value.headers.get("x-source"), "xhr");
    assert.equal(await result.value.text(), '{"ok":true}');
  });

  it("maps network errors to FetchError results", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    MockXMLHttpRequest.scenario = {
      onSend(xhr) {
        xhr.fail();
      },
    };

    const handler = createXhrHandler();
    const result = await handler("https://example.com/users");

    assert.equal(isErr(result), true);

    if (!isErr(result)) {
      throw new Error("Expected XHR request to fail.");
    }

    assert.equal(result.error.name, "FetchError");
  });

  it("maps XHR timeouts to TimeoutError results", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    MockXMLHttpRequest.scenario = {
      onSend(xhr) {
        xhr.timeout = 25;
        xhr.timeoutRequest();
      },
    };

    const handler = createXhrHandler();
    const result = await handler("https://example.com/slow");

    assert.equal(isErr(result), true);

    if (!isErr(result)) {
      throw new Error("Expected timeout request to fail.");
    }

    if (!(result.error instanceof TimeoutError)) {
      throw new Error("Expected timeout error.");
    }

    assert.equal(result.error.timeoutMs, 25);
  });

  it("aborts the underlying XHR when the signal aborts", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    MockXMLHttpRequest.scenario = {
      onSend() {},
    };

    const handler = createXhrHandler();
    const controller = new AbortController();
    const pending = handler("https://example.com/abort", {
      signal: controller.signal,
    });

    controller.abort();

    const result = await pending;

    assert.equal(isErr(result), true);

    if (!isErr(result)) {
      throw new Error("Expected aborted request to fail.");
    }

    assert.equal(result.error.name, "FetchError");
  });

  it("delivers observer progress events", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    const uploadEvents: HttpProgressEvent[] = [];
    const downloadEvents: HttpProgressEvent[] = [];

    MockXMLHttpRequest.scenario = {
      onSend(xhr) {
        xhr.emitUploadProgress({
          lengthComputable: true,
          loaded: 5,
          total: 10,
        });
        xhr.emitDownloadProgress({
          lengthComputable: true,
          loaded: 8,
          total: 16,
        });
        xhr.complete({ body: "done", status: 200 });
      },
    };

    const handler = createXhrHandler();
    const result = await handler("https://example.com/upload", {
      body: "payload",
      method: "POST",
      observer(requestObserver, responseObserver) {
        requestObserver.onprogress = (event) => {
          uploadEvents.push(event);
        };

        responseObserver.onprogress = (event) => {
          downloadEvents.push(event);
        };
      },
    });

    assert.equal(isOk(result), true);
    assert.deepEqual(uploadEvents, [
      { lengthComputable: true, loaded: 5, total: 10 },
    ]);
    assert.deepEqual(downloadEvents, [
      { lengthComputable: true, loaded: 8, total: 16 },
    ]);
  });

  it("performs a real placeholder image download", async () => {
    globalThis.XMLHttpRequest =
      NodeXMLHttpRequest as unknown as typeof XMLHttpRequest;

    const downloadEvents: HttpProgressEvent[] = [];
    const handler = createXhrHandler();
    const result = await handler("https://placehold.co/600x400/png", {
      observer(_requestObserver, responseObserver) {
        responseObserver.onprogress = (event) => {
          downloadEvents.push(event);
        };
      },
    });

    assert.equal(isOk(result), true);

    if (!isOk(result)) {
      throw new Error("Expected placeholder image download to succeed.");
    }

    const payload = await result.value.arrayBuffer();

    assert.equal(payload.byteLength > 0, true);
    assert.equal(downloadEvents.length > 0, true);

    const lastDownloadEvent = downloadEvents.at(-1);

    assert.equal(lastDownloadEvent?.lengthComputable, true);
    assert.equal(lastDownloadEvent?.loaded, payload.byteLength);
    assert.equal(lastDownloadEvent?.total, payload.byteLength);
  });

  it("works with decoders and composed interceptors", async () => {
    globalThis.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    MockXMLHttpRequest.scenario = {
      onSend(xhr) {
        assert.equal(xhr.getHeader("accept"), "text/plain");
        xhr.complete({
          body: "Ada",
          headers: "content-type: text/plain",
          status: 200,
        });
      },
    };

    const handler = composeInterceptors(withHeaders({ accept: "text/plain" }))(
      createXhrHandler(),
    );

    const result = await handler("https://example.com/name");
    const body = await text(expectStatus(result, 200));

    assert.equal(isOk(body), true);

    if (!isOk(body)) {
      throw new Error("Expected decoder to succeed.");
    }

    assert.equal(body.value, "Ada");
  });
});
