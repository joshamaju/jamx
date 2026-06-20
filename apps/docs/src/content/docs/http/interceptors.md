---
title: Interceptors
description: Shape requests before they reach the terminal fetch handler.
---

Interceptors receive a grouped request object and a `next` function. They can update the request, pass it forward, or call `next()` unchanged.

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
```

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
