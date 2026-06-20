---
title: API Reference
description: Curated reference for the public @jamx/http exports.
---

## Fetch Core

- `defaultContext`: reusable `Context` backed by `globalThis.fetch`.
- `defaultFetch`: default fetch handler created from `defaultContext`.
- `createFetchHandler(context)`: creates a fetch handler from a supplied context.
- `normalizeInput(input, init?)`: converts normalized input or fetch-style arguments into the request shape used by interceptors.

## Composition

- `compose(...interceptors)`: creates a composed handler around a terminal fetch handler.
- `defineInterceptor(interceptor)`: defines a request interceptor.

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

- `TimeoutError` extends `FetchError` and is returned when `withTimeout` aborts the underlying request.
