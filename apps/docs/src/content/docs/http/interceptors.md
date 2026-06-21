---
title: Interceptors
description: Shape requests without losing downstream result and error types.
---

Interceptors receive a grouped request object and a `next` function. They can update the request, pass it forward, or call `next()` unchanged.

`next()` returns the downstream `Either` result. If an interceptor returns that result unchanged, the downstream error type is preserved. If it adds a new failure path, that error is added to the final result type.

```ts
import { compose, defaultFetch, defineInterceptor } from "@jamx/http";

const withTenant = defineInterceptor(async ({ request, next }) => {
  const headers = new Headers(request.init?.headers);
  headers.set("x-tenant", "team-a");

  return next({
    input: request.input,
    init: { ...request.init, headers },
  });
});

const handler = compose(withTenant)(defaultFetch);

type HandlerResult = Awaited<ReturnType<typeof handler>>;
// Either<FetchError, Response>
```

The `withTenant` interceptor only changes the request, so the result type is still the network result from `defaultFetch`.

## Adding Errors In An Interceptor

Interceptors can safely add their own errors. This example reads the response body as text. `text(...)` can add `ParseError`, and the original `FetchError` from the network call is still present.

```ts
import {
  compose,
  defaultFetch,
  defineInterceptor,
  text,
  type Either,
  type FetchError,
  type ParseError,
} from "@jamx/http";

const withBodyText = defineInterceptor(async ({ next }) => {
  const result = await next();
  if (!result.ok) return result;

  return text(result.value);
});

const handler = compose(withBodyText)(defaultFetch);

type HandlerResult = Awaited<ReturnType<typeof handler>>;
// Either<FetchError | ParseError, string>
```

No error is widened to `unknown` or collapsed into a generic exception type. The final handler tells callers exactly which failures they need to handle.

## Request Shape

The normalized request shape mirrors `fetch(input, init?)`:

```ts
type Input = {
  input: RequestInfo | URL;
  init?: RequestInit;
};
```

`next` accepts normalized input or fetch-style arguments:

```ts
await next();
await next({ input: "https://api.example.com/users" });
await next("https://api.example.com/users");
await next("https://api.example.com/users", {
  headers: { accept: "application/json" },
});
```

Each `next(...)` form preserves the downstream result type. Changing the request does not change the errors unless the interceptor returns an additional `Either` failure.

## Base URLs

`compose` keeps requests normalized until the terminal handler runs. That allows `withBaseUrl` to resolve relative paths before a platform `Request` is constructed.

```ts
const api = compose(withBaseUrl("https://api.example.com/v1"))(defaultFetch);

await api("/users?role=admin");
```

## Ordering Notes

- Put request-shaping interceptors like `withHeaders` and `withAuth` before `withCache` so cache keys can include final headers.
- Static `withHeaders(...)` and `withAuth(...)` values can run before or after `withBaseUrl`.
- Callback forms that receive a concrete `Request` should run after `withBaseUrl` when the original input may be relative.
- `withRetry` only retries idempotent methods by default. Pass `methods: ["POST"]` to opt a write request into replay.
