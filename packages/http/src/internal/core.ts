import { type Either, err, ok } from "./either.js";
import type { AnyEither } from "./types.js";

export interface Context {
  fetch: typeof globalThis.fetch;
}

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

type ComposeResult<
  TInterceptors extends readonly AnyInterceptor[],
  TResult extends AnyEither = Result,
> = TInterceptors extends readonly [
  infer THead extends AnyInterceptor,
  ...infer TTail extends readonly AnyInterceptor[],
]
  ? InterceptorResult<THead> | ComposeResult<TTail, TResult>
  : TResult;

export interface ExecutableHandler<TResult extends AnyEither> {
  (input: RequestInfo | URL): Promise<TResult>;
  (input: RequestInfo | URL, init?: RequestInit): Promise<TResult>;
}

export class FetchError extends Error {
  name = "FetchError";

  constructor(message = "Fetch request failed.", cause?: unknown) {
    super(message, { cause });
  }
}

export class TimeoutError extends FetchError {
  name = "TimeoutError";
  readonly timeoutMs: number;

  constructor(timeoutMs: number, cause?: unknown) {
    super(`Fetch request timed out after ${timeoutMs}ms.`, cause);
    this.timeoutMs = timeoutMs;
  }
}

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

export const defaultFetch = createFetchHandler(defaultContext);

export const composeInterceptors =
  <const TInterceptors extends readonly AnyInterceptor[]>(
    ...interceptors: TInterceptors
  ) =>
  <THandler extends Handler>(
    handler: THandler,
  ): ExecutableHandler<ComposeResult<TInterceptors>> => {
    const execute = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<ComposeResult<TInterceptors>> => {
      const request = new Request(input, init);

      const dispatch = async (
        index: number,
        currentRequest: Request,
      ): Promise<ComposeResult<TInterceptors>> => {
        const interceptor = interceptors[index];

        if (!interceptor) {
          return handler(currentRequest) as Promise<
            ComposeResult<TInterceptors>
          >;
        }

        return interceptor({
          request: currentRequest,
          next: (nextRequest = currentRequest) =>
            dispatch(index + 1, nextRequest),
        }) as Promise<ComposeResult<TInterceptors>>;
      };

      return dispatch(0, request);
    };

    return execute as ExecutableHandler<ComposeResult<TInterceptors>>;
  };

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
