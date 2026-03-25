# `@jamx/http`

Composable HTTP helpers built around `fetch`, interceptors, and `Either`-style
results.

## Quick Start

```ts
import {
  composeInterceptors,
  createMemoryCacheStore,
  defaultFetch,
  withAuth,
  withCache,
  withHeaders,
  withRetry,
  withTimeout,
} from "@jamx/http";

const cache = createMemoryCacheStore();

const handler = composeInterceptors(
  withTimeout(250),
  withHeaders({ accept: "application/json" }),
  withAuth("demo-token"),
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
)(defaultFetch);
```

## Core APIs

```ts
import {
  createFetchHandler,
  decodeJson,
  defaultContext,
  defaultFetch,
  expectStatus,
} from "@jamx/http";

const customFetch = createFetchHandler(defaultContext);

const response = await defaultFetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);
```

- `defaultContext` is a reusable `Context` backed by `globalThis.fetch`.
- `defaultFetch` is `createFetchHandler(defaultContext)`.
- `createFetchHandler(...)` is useful when you want to inject a mocked or custom
  fetch implementation.

## Decoder Helpers

Decoder helpers accept either a plain `Response` or an `Either<..., Response>`.

```ts
import { decodeJson, json, text } from "@jamx/http";

const rawResponse = await fetch("https://api.example.com/users/42");

const bodyText = await text(rawResponse);
const bodyJson = await json(rawResponse);
const user = await decodeJson(rawResponse, decodeUser);
```

When you already have an `Either`, upstream errors are preserved in the helper
result type.

## Notes

- Put request-shaping interceptors like `withHeaders` and `withAuth` before
  `withCache` so cache keys can include the final request headers.
- `withRetry` only retries idempotent methods by default. Pass
  `methods: ["POST"]` if you need to opt a write request into replay.
- `withTimeout` aborts the underlying request and returns a `TimeoutError`
  when the timeout elapses. `TimeoutError` extends `FetchError`.
