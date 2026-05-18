import { defineInterceptor, type Result } from "./core.js";
import type { Left } from "./either.js";
import { isErr, isOk, ok } from "./either.js";

/**
 * Rebases a request URL onto a configured base URL while preserving the
 * original path, query string, and hash.
 *
 * @example
 * ```ts
 * import { compose, defaultFetch, withBaseUrl } from "@jamx/http";
 *
 * const fetcher = compose(withBaseUrl("https://api.example.com/v1"))(defaultFetch);
 * ```
 */
export function withBaseUrl(base_url: string | URL) {
  return defineInterceptor(async ({ request, next }) => {
    const current_url = new URL(request.url);

    const url = new URL(
      `${trimTrailingSlash(base_url.toString())}/${trimLeadingSlash(
        `${current_url.pathname}${current_url.search}${current_url.hash}`,
      )}`,
    );

    return next(new Request(url, request));
  });
}

/**
 * Merges additional headers into the outgoing request.
 *
 * @example
 * ```ts
 * import { composeInterceptors, defaultFetch, withHeaders } from "@jamx/http";
 *
 * const fetcher = composeInterceptors(
 *   withHeaders({ accept: "application/json" }),
 * )(defaultFetch);
 * ```
 */
export function withHeaders(
  headers: HeadersInit | ((request: Request) => HeadersInit),
) {
  return defineInterceptor(async ({ request, next }) => {
    const next_headers = new Headers(request.headers);
    const extra_headers =
      typeof headers === "function" ? headers(request) : headers;

    new Headers(extra_headers).forEach((value, key) => {
      next_headers.set(key, value);
    });

    return next(new Request(request, { headers: next_headers }));
  });
}

/**
 * Adds an `Authorization` header using the given token and scheme.
 *
 * @example
 * ```ts
 * import { composeInterceptors, defaultFetch, withAuth } from "@jamx/http";
 *
 * const fetcher = composeInterceptors(withAuth("demo-token"))(defaultFetch);
 * ```
 */
export function withAuth(
  token: string | ((request: Request) => string),
  scheme = "Bearer",
) {
  return defineInterceptor(async ({ request, next }) => {
    const resolvedToken = typeof token === "function" ? token(request) : token;
    const headers = new Headers(request.headers);
    headers.set("authorization", `${scheme} ${resolvedToken}`);
    return next(new Request(request, { headers }));
  });
}

/**
 * Aborts requests that take longer than the given timeout.
 *
 * @example
 * ```ts
 * import { composeInterceptors, defaultFetch, withTimeout } from "@jamx/http";
 *
 * const fetcher = composeInterceptors(withTimeout(500))(defaultFetch);
 * ```
 */
export class TimeoutError extends Error {
  name = "TimeoutError";
  readonly _tag = "FetchError";

  readonly timeoutMs: number;

  constructor(timeoutMs: number, cause?: unknown) {
    super(`Fetch request timed out after ${timeoutMs}ms.`, { cause });
    this.timeoutMs = timeoutMs;
  }
}

export const withTimeout = (timeoutMs: number) =>
  defineInterceptor(async ({ request, next }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const timed_request = new Request(request, {
      signal: mergeSignals(request.signal, controller.signal),
    });

    try {
      return await Promise.race([
        next(timed_request),
        new Promise<Left<TimeoutError>>((resolve) => {
          timed_request.signal.addEventListener(
            "abort",
            () => {
              resolve({ ok: false, error: new TimeoutError(timeoutMs) });
            },
            { once: true },
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  });

function mergeSignals(
  left: AbortSignal | null,
  right: AbortSignal,
): AbortSignal {
  if (!left) return right;

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
}

/**
 * Retries idempotent requests when they fail with transport errors or `5xx`
 * responses.
 *
 * @example
 * ```ts
 * import { composeInterceptors, defaultFetch, withRetry } from "@jamx/http";
 *
 * const fetcher = composeInterceptors(withRetry({ retries: 2 }))(defaultFetch);
 * ```
 */
export interface RetryOptions {
  retries: number;
  methods?: readonly string[];
  shouldRetry?: (
    result: Result,
    attempt: number,
    request: Request,
  ) => boolean | Promise<boolean>;
}

export function withRetry(options: RetryOptions) {
  return defineInterceptor(async ({ request, next }) => {
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      const attempt_request = new Request(request);
      const result = await next(attempt_request);

      const should_retry = await shouldRetryResult(
        result,
        attempt,
        request,
        options,
      );

      if (!should_retry) return result;
    }

    return next(new Request(request));
  });
}

async function shouldRetryResult(
  result: Result,
  attempt: number,
  request: Request,
  options: RetryOptions,
): Promise<boolean> {
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
}

/**
 * Caches successful `GET` responses in a store.
 *
 * @example
 * ```ts
 * import { composeInterceptors, createMemoryCacheStore, defaultFetch, withCache } from "@jamx/http";
 *
 * const store = createMemoryCacheStore();
 * const fetcher = composeInterceptors(withCache({ store }))(defaultFetch);
 * ```
 */
export interface CacheStore {
  get(key: string): Response | undefined | Promise<Response | undefined>;
  set(key: string, response: Response): void | Promise<void>;
}

export interface CacheOptions {
  store?: CacheStore;
  key?: (request: Request) => string;
  shouldCache?: (result: Result, request: Request) => boolean;
}

export function withCache(options: CacheOptions = {}) {
  const store = options.store ?? createMemoryCacheStore();

  return defineInterceptor(async ({ request, next }) => {
    const key = (options.key ?? defaultCacheKey)(request);

    if (request.method === "GET") {
      const cached = await store.get(key);
      if (cached) return ok(cached.clone());
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
}

/**
 * Creates an in-memory cache store compatible with `withCache`.
 *
 * @example
 * ```ts
 * import { createMemoryCacheStore } from "@jamx/http";
 *
 * const store = createMemoryCacheStore();
 * ```
 */
export function createMemoryCacheStore(): CacheStore {
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
}

const defaultShouldCache = (result: Result): boolean => {
  return isOk(result) && result.value.ok;
};

const defaultCacheKey = (request: Request): string => {
  return `${request.method}:${request.url}:${serializeHeaders(request.headers)}`;
};

const DEFAULT_RETRY_METHODS = new Set([
  "GET",
  "PUT",
  "HEAD",
  "TRACE",
  "DELETE",
  "OPTIONS",
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
