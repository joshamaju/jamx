import { type Either, err, ok } from "./either.js";
import type { AnyEither } from "./types.js";

export interface Context {
  fetch: typeof globalThis.fetch;
}

/**
 * Default HTTP context backed by the platform `fetch` implementation.
 *
 * @example
 * ```ts
 * import { createFetchHandler, defaultContext } from "@jamx/http";
 *
 * const fetcher = createFetchHandler(defaultContext);
 * ```
 */
export const defaultContext: Context = {
  fetch: globalThis.fetch,
};

export interface Input {
  input: RequestInfo | URL;
  init?: RequestInit;
}

export type Result = Either<FetchError, Response>;

export type Handler = (request: Request) => Promise<Result>;

export type Next<R extends AnyEither> = (request?: Request) => Promise<R>;

export interface InterceptorContext<T extends AnyEither> {
  request: Request;
  next: Next<T>;
}

export interface Chain extends InterceptorContext<Result> {}

export type Interceptor<
  AddedResult extends AnyEither = never,
  DownstreamResult extends AnyEither = Result,
> = (
  ctx: InterceptorContext<DownstreamResult>,
) => Promise<DownstreamResult | AddedResult>;

type AnyInterceptor = (args: InterceptorContext<any>) => Promise<AnyEither>;

type InterceptorResult<TInterceptor extends AnyInterceptor> = Awaited<
  ReturnType<TInterceptor>
>;

/**
 * Type helper for the final `Either` result produced by a composed interceptor chain.
 *
 * @example
 * ```ts
 * import type { ComposeInterceptorsResult, Result } from "@jamx/http";
 *
 * type FinalResult = ComposeInterceptorsResult<[], Result>;
 * ```
 */
export type ComposeInterceptorsResult<
  TInterceptors extends readonly AnyInterceptor[],
  TResult extends AnyEither = Result,
> = TInterceptors extends readonly [
  infer THead extends AnyInterceptor,
  ...infer TTail extends readonly AnyInterceptor[],
]
  ? InterceptorResult<THead> | ComposeInterceptorsResult<TTail, TResult>
  : TResult;

export interface ExecutableHandler<TResult extends AnyEither> {
  (input: RequestInfo | URL): Promise<TResult>;
  (input: RequestInfo | URL, init?: RequestInit): Promise<TResult>;
}

/**
 * Base error returned when a request fails before a response is produced.
 */
export class FetchError extends Error {
  name = "FetchError";
  readonly _tag = "FetchError";

  constructor(message = "Fetch request failed.", cause?: unknown) {
    super(message, { cause });
  }
}

/**
 * Creates a `fetch`-backed handler that returns `Either<FetchError, Response>`.
 *
 * @example
 * ```ts
 * import { createFetchHandler, defaultContext } from "@jamx/http";
 *
 * const fetcher = createFetchHandler(defaultContext);
 * const result = await fetcher(new Request("https://example.com"));
 * ```
 */
export const createFetchHandler = (context: Context): Handler => {
  return async (request) => {
    try {
      const response = await context.fetch(request);
      return ok(response);
    } catch (error) {
      return err(normalizeError(error));
    }
  };
};

/**
 * Ready-to-use HTTP handler backed by `globalThis.fetch`.
 *
 * @example
 * ```ts
 * import { defaultFetch } from "@jamx/http";
 *
 * const result = await defaultFetch("https://example.com/users");
 * ```
 */
export const defaultFetch = createFetchHandler(defaultContext);

/**
 * Composes one or more interceptors into an executable HTTP handler.
 *
 * @example
 * ```ts
 * import { compose, defaultFetch, withAuth, withTimeout } from "@jamx/http";
 *
 * const handler = compose(
 *   withTimeout(250),
 *   withAuth("demo-token"),
 * )(defaultFetch);
 * ```
 */
export const compose =
  <const TInterceptors extends readonly AnyInterceptor[]>(
    ...interceptors: TInterceptors
  ) =>
  <THandler extends Handler>(
    handler: THandler,
  ): ExecutableHandler<ComposeInterceptorsResult<TInterceptors>> => {
    const execute = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<ComposeInterceptorsResult<TInterceptors>> => {
      const request = new Request(input, init);

      const dispatch = async (
        index: number,
        currentRequest: Request,
      ): Promise<ComposeInterceptorsResult<TInterceptors>> => {
        const interceptor = interceptors[index];

        if (!interceptor) {
          return handler(currentRequest) as Promise<
            ComposeInterceptorsResult<TInterceptors>
          >;
        }

        return interceptor({
          request: currentRequest,
          next: (nextRequest = currentRequest) =>
            dispatch(index + 1, nextRequest),
        }) as Promise<ComposeInterceptorsResult<TInterceptors>>;
      };

      return dispatch(0, request);
    };

    return execute as ExecutableHandler<
      ComposeInterceptorsResult<TInterceptors>
    >;
  };

/**
 * Defines an interceptor while preserving its inferred result type.
 *
 * @example
 * ```ts
 * import { defineInterceptor, ok } from "@jamx/http";
 *
 * const interceptor = defineInterceptor(async ({ next }) => {
 *   const result = await next();
 *   return result.ok ? ok(result.value) : result;
 * });
 * ```
 */
export const defineInterceptor = <
  TInterceptor extends (args: Chain) => Promise<AnyEither>,
>(
  interceptor: TInterceptor,
): TInterceptor => interceptor;

function normalizeError(error: unknown): FetchError {
  if (error instanceof FetchError) {
    return error;
  }

  if (error instanceof Error) {
    return new FetchError(error.message, error);
  }

  if (typeof error === "string") {
    return new FetchError(error, error);
  }

  return new FetchError("Fetch request failed.", error);
}
