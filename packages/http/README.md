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
  withJsonBody({ tenant: "team-a" }),
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
)(defaultFetch);
```

## Core APIs

```ts
import {
  createFetchHandler,
  createXhrHandler,
  decodeJson,
  defaultContext,
  defaultFetch,
  expectStatus,
} from "@jamx/http";

const customFetch = createFetchHandler(defaultContext);

const response = await defaultFetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);

---

const fetchXhr = createXhrHandler();

await fetchXhr("https://api.example.com/upload", {
  body: file,
  method: "POST",
  observer(requestObserver, responseObserver) {
    requestObserver.onprogress = (event) => {
      console.log("upload", event.loaded, event.total);
    };

    responseObserver.onprogress = (event) => {
      console.log("download", event.loaded, event.total);
    };
  },
});
```

- `defaultContext` is a reusable `Context` backed by `globalThis.fetch`.
- `defaultFetch` is `createFetchHandler(defaultContext)`.
- `createFetchHandler(...)` is useful when you want to inject a mocked or custom
  fetch implementation.
- `createXhrHandler(...)` provides a browser-only `XMLHttpRequest` transport that
  mirrors the proposed fetch `observer(...)` progress API while still returning
  standard `Response` values.
- `composeInterceptors(...)` returns an executable handler with a composed result.

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
- `withRetry` only retries idempotent methods by default. Pass
  `methods: ["POST"]` if you need to opt a write request into replay.
- `validate(result, schema)` accepts an `Either` plus a Standard Schema
  compatible validator such as Zod.
- `withTimeout` aborts the underlying request and returns a `TimeoutError`
  when the timeout elapses. `TimeoutError` extends `FetchError`.
