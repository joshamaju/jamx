# `@jamx/http`

Composable HTTP helpers built around `fetch`, interceptors, and `Either`-style
results.

## Install

```bash
pnpm add @jamx/http
```

## Quick Start

```ts
import {
  compose,
  createMemoryCacheStore,
  defaultFetch,
  withAuth,
  withBaseUrl,
  withCache,
  withHeaders,
  withRetry,
  withTimeout,
} from "@jamx/http";

const cache = createMemoryCacheStore();

const handler = compose(
  withTimeout(250),
  withBaseUrl("https://api.example.com/v1"),
  withHeaders({ accept: "application/json" }),
  withAuth("demo-token"),
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
)(defaultFetch);

const response = await handler("/users/42");
```

## Core APIs

```ts
import {
  createFetchHandler,
  decodeJson,
  defaultContext,
  defaultFetch,
  expectStatus,
  normalizeInput,
} from "@jamx/http";

const customFetch = createFetchHandler(defaultContext);

const response = await defaultFetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);
```

- `defaultContext` is a reusable `Context` backed by `globalThis.fetch`.
- `defaultFetch` is `createFetchHandler(defaultContext)`.
- `createFetchHandler(...)` is useful when you want to inject a mocked or custom
  fetch implementation.
- `compose(...)` returns an executable handler with a composed result.
- `normalizeInput(...)` converts either `{ input, init }` or fetch-style
  `(input, init?)` into the normalized request shape used by interceptors.

## Interceptors

Interceptors receive a grouped request object and a `next` function.

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

The request shape mirrors `fetch(input, init?)`:

```ts
type Input = {
  input: RequestInfo | URL;
  init?: RequestInit;
};
```

`next` accepts all of these forms:

```ts
await next();
await next({ input: "https://api.example.com/users" });
await next("https://api.example.com/users");
await next("https://api.example.com/users", {
  headers: { accept: "application/json" },
});
```

`compose` keeps requests in this normalized shape until the terminal fetch
handler runs. That allows `withBaseUrl` to resolve relative paths before a
platform `Request` is constructed:

```ts
const api = compose(withBaseUrl("https://api.example.com/v1"))(defaultFetch);

await api("/users?role=admin");
```

Use `normalizeInput` when a helper accepts either normalized input or fetch-style
arguments:

```ts
const normalized = normalizeInput("https://api.example.com/users", {
  method: "POST",
});

normalized.input;
normalized.init;
```

## Decoder Helpers

Decoder helpers accept either a plain `Response` or an `Either<..., Response>`.

```ts
import { decodeJson, json, text, validate } from "@jamx/http";
import { z } from "zod";

const rawResponse = await fetch("https://api.example.com/users/42");
const userSchema = z.object({ id: z.number(), name: z.string() });

const bodyText = await text(rawResponse);
const bodyJson = await json(rawResponse);
const user = await decodeJson(rawResponse, decodeUser);
const userWithSchema = await validate(bodyJson, userSchema);
```

When you already have an `Either`, upstream errors are preserved in the helper
result type.

## Notes

- `withBaseUrl` rebases request paths onto a configured base URL.
- Put request-shaping interceptors like `withHeaders` and `withAuth` before
  `withCache` so cache keys can include the final request headers.
- Static `withHeaders(...)` and `withAuth(...)` values can run before or after
  `withBaseUrl`. Callback forms that receive a concrete `Request` should run
  after `withBaseUrl` when the original input may be relative.
- `withRetry` only retries idempotent methods by default. Pass
  `methods: ["POST"]` if you need to opt a write request into replay.
- `validate(result, schema)` accepts an `Either` plus a Standard Schema
  compatible validator such as Zod.
- `withTimeout` aborts the underlying request and returns a `TimeoutError`
  when the timeout elapses. `TimeoutError` extends `FetchError`.
