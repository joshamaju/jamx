import { defineInterceptor, Result, TimeoutError } from "./core.js";
import { isErr, isOk, ok } from "./either.js";
import type { Left } from "./either.js";

export const withBaseUrl = (baseUrl: string | URL) =>
  defineInterceptor(async ({ request, next }) => {
    const currentUrl = new URL(request.url);

    const url = new URL(
      `${trimTrailingSlash(baseUrl.toString())}/${trimLeadingSlash(
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      )}`,
    );

    // let url_ = url
    //   ? baseUrl.toString().replace(/\/+$/, "") + "/" + request.url.replace(/^\/+/, "")
    //   : baseUrl;

    return next(new Request(url, request));
  });

export const withHeaders = (
  headers: HeadersInit | ((request: Request) => HeadersInit),
) =>
  defineInterceptor(async ({ request, next }) => {
    const nextHeaders = new Headers(request.headers);
    const extraHeaders =
      typeof headers === "function" ? headers(request) : headers;

    new Headers(extraHeaders).forEach((value, key) => {
      nextHeaders.set(key, value);
    });

    return next(new Request(request, { headers: nextHeaders }));
  });

export const withAuth = (
  token: string | ((request: Request) => string),
  scheme = "Bearer",
) =>
  defineInterceptor(async ({ request, next }) => {
    const resolvedToken = typeof token === "function" ? token(request) : token;
    const headers = new Headers(request.headers);
    headers.set("authorization", `${scheme} ${resolvedToken}`);
    return next(new Request(request, { headers }));
  });

export const withTimeout = (timeoutMs: number) =>
  defineInterceptor(async ({ request, next }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const timedRequest = new Request(request, {
      signal: mergeSignals(request.signal, controller.signal),
    });

    try {
      return await Promise.race([
        next(timedRequest),
        new Promise<Left<TimeoutError>>((resolve) => {
          timedRequest.signal.addEventListener(
            "abort",
            () => {
              resolve({
                ok: false,
                error: new TimeoutError(timeoutMs),
              });
            },
            { once: true },
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  });

const mergeSignals = (
  left: AbortSignal | null,
  right: AbortSignal,
): AbortSignal => {
  if (!left) {
    return right;
  }

  const anySignal = AbortSignal;

  if (typeof anySignal.any === "function") {
    return anySignal.any([left, right]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (left.aborted || right.aborted) {
    controller.abort();
    return controller.signal;
  }

  left.addEventListener("abort", abort, { once: true });
  right.addEventListener("abort", abort, { once: true });

  return controller.signal;
};

export interface RetryOptions {
  retries: number;
  methods?: readonly string[];
  shouldRetry?: (
    result: Result,
    attempt: number,
    request: Request,
  ) => boolean | Promise<boolean>;
}

export const withRetry = (options: RetryOptions) =>
  defineInterceptor(async ({ request, next }) => {
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      const attemptRequest = new Request(request);
      const result = await next(attemptRequest);

      const shouldRetry = await shouldRetryResult(
        result,
        attempt,
        request,
        options,
      );

      if (!shouldRetry) {
        return result;
      }
    }

    return next(new Request(request));
  });

const shouldRetryResult = async (
  result: Result,
  attempt: number,
  request: Request,
  options: RetryOptions,
): Promise<boolean> => {
  if (attempt >= options.retries) {
    return false;
  }

  if (!isRetryableMethod(request.method, options.methods)) {
    return false;
  }

  if (options.shouldRetry) {
    return options.shouldRetry(result, attempt, request);
  }

  return isErr(result) || (isOk(result) && result.value.status >= 500);
};

export interface CacheStore {
  get(key: string): Response | undefined | Promise<Response | undefined>;
  set(key: string, response: Response): void | Promise<void>;
}

export interface CacheOptions {
  store?: CacheStore;
  key?: (request: Request) => string;
  shouldCache?: (result: Result, request: Request) => boolean;
}

export const withCache = (options: CacheOptions = {}) => {
  const store = options.store ?? createMemoryCacheStore();

  return defineInterceptor(async ({ request, next }) => {
    const key = (options.key ?? defaultCacheKey)(request);

    if (request.method === "GET") {
      const cached = await store.get(key);

      if (cached) {
        return ok(cached.clone());
      }
    }

    const result = await next(new Request(request));

    if (
      request.method === "GET" &&
      isOk(result) &&
      (options.shouldCache ?? defaultShouldCache)(result, request)
    ) {
      await store.set(key, result.value.clone());
    }

    return result;
  });
};

export const createMemoryCacheStore = (): CacheStore => {
  const store = new Map<string, Response>();

  return {
    get(key) {
      const cached = store.get(key);
      return cached?.clone();
    },
    set(key, response) {
      store.set(key, response.clone());
    },
  };
};

const defaultShouldCache = (result: Result): boolean =>
  isOk(result) && result.value.ok;

const defaultCacheKey = (request: Request): string =>
  `${request.method}:${request.url}:${serializeHeaders(request.headers)}`;

const DEFAULT_RETRY_METHODS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PUT",
  "TRACE",
]);

const isRetryableMethod = (
  method: string,
  methods?: readonly string[],
): boolean => {
  const normalizedMethod = method.toUpperCase();

  if (!methods) {
    return DEFAULT_RETRY_METHODS.has(normalizedMethod);
  }

  return methods.some(
    (candidate) => candidate.toUpperCase() === normalizedMethod,
  );
};

const serializeHeaders = (headers: Headers): string => {
  const serialized: string[] = [];

  headers.forEach((value, key) => {
    serialized.push(`${key}:${value}`);
  });

  return serialized.sort((left, right) => left.localeCompare(right)).join("|");
};

const trimLeadingSlash = (value: string): string => value.replace(/^\/+/, "");

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
