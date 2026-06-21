---
title: API Reference
description: Curated reference for the public @jamx/http exports.
---

## Fetch Core

- `Result`: the base network result type, `Either<FetchError, Response>`.
- `defaultContext`: reusable `Context` backed by `globalThis.fetch`.
- `defaultFetch`: default fetch handler created from `defaultContext`.
- `createFetchHandler(context)`: creates a fetch handler from a supplied context.
- `Handler<TResult>`: a normalized request handler that is also executable with fetch-style `(input, init?)` arguments.
- `normalizeInput(input, init?)`: converts normalized input or fetch-style arguments into the request shape used by interceptors.

## Composition

- `compose(...interceptors)`: creates a composed handler around a terminal fetch handler.
- `defineInterceptor(interceptor)`: defines a request interceptor.
- `Interceptor<AddedResult, DownstreamResult>`: an async pipeline step that can preserve downstream results or add its own typed `Either` result.
- `ComposeInterceptorsResult<TInterceptors, TResult>`: computes the final `Either` result type for a composed pipeline.

```ts
const handler = compose(withTimeout(250))(defaultFetch);

type HandlerResult = Awaited<ReturnType<typeof handler>>;
// Either<FetchError | TimeoutError, Response>
```

## Interceptors

- `withBaseUrl(baseUrl)`: resolves relative request paths against a base URL.
- `withHeaders(headers)`: adds headers to outgoing requests.
- `withAuth(tokenOrCallback)`: adds authentication data to outgoing requests.
- `withCache(options)`: caches request results with a configured store.
- `withRetry(options)`: retries eligible failed requests.
- `withTimeout(ms)`: aborts requests that exceed the timeout and returns a `TimeoutError`.

## Decoders And Validation

- `text(responseOrResult)`: reads a response body as text.
- `json(responseOrResult)`: reads a response body as JSON.
- `decodeJson(responseOrResult, decoder)`: decodes a JSON response with a supplied decoder.
- `validate(result, schema)`: validates a result with a Standard Schema compatible validator.
- `expectStatus(responseOrResult, status)`: requires a matching response status.

## Errors

- `FetchError`: normalized network/request failure returned by `createFetchHandler(...)`.
- `TimeoutError`: returned when `withTimeout` aborts the underlying request.
- `ParseError`: returned by body helpers such as `json(...)`, `text(...)`, and `empty(...)`.
- `DecodeError`: the base shape for decoder failures returned by `decodeJson(...)`.
- `SchemaError`: returned by `validate(...)` when a Standard Schema compatible validator rejects the value.
- `StatusError`: returned by `expectStatus(...)` and status-range helpers when the response status does not match.
