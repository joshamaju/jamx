# `@jamx/http`

Composable HTTP helpers built around `fetch`, interceptors, and `Either`-style
results.

## Usage

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

## Notes

- Put request-shaping interceptors like `withHeaders` and `withAuth` before
  `withCache` so cache keys can include the final request headers.
- `withRetry` only retries idempotent methods by default. Pass
  `methods: ["POST"]` if you need to opt a write request into replay.
- `withTimeout` aborts the underlying request and returns a `TimeoutError`
  when the timeout elapses. `TimeoutError` extends `FetchError`.
