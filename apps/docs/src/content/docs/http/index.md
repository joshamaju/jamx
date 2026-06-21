---
title: "@jamx/http"
description: Type-safe fetch pipelines with interceptors, decoders, validation, and preserved errors.
---

`@jamx/http` provides a small set of composable helpers for building type-safe `fetch` workflows. It keeps request shaping, response handling, decoding, retries, caching, and validation as separate pieces while preserving the errors each step can return.

The result is an `Either`: success is available as `result.value`, failure is available as `result.error`, and TypeScript keeps track of the possible error types through the whole pipeline.

## Install

```bash
pnpm add @jamx/http
```

## Core Ideas

- Compose request behavior with interceptors without losing downstream error types.
- Keep requests in a normalized shape until the terminal fetch handler runs.
- Decode and validate responses through helpers that add their own errors while preserving upstream errors.
- Use `Either`-style results for explicit success and failure paths.

## Common Flow

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

const fetch = compose(
  withTimeout(250),
  withBaseUrl("https://api.example.com/v1"),
  withHeaders({ accept: "application/json" }),
  withAuth("demo-token"),
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
)(defaultFetch);

const response = await fetch("/users/42");
```

## Type-Safe Error Pipeline

Every handler returns a typed `Either`. A composed pipeline can add new failure types, but it does not erase failures from later interceptors or the terminal network call.

```ts
import {
  compose,
  defaultFetch,
  type Either,
  type FetchError,
  type TimeoutError,
  withTimeout,
} from "@jamx/http";

const fetch = compose(withTimeout(250))(defaultFetch);

type FetchResult = Awaited<ReturnType<typeof fetch>>;
// Either<FetchError | TimeoutError, Response>
```

The same applies when an interceptor parses or transforms the response:

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

const fetchText = compose(withBodyText)(defaultFetch);

type FetchTextResult = Awaited<ReturnType<typeof fetchText>>;
// Either<FetchError | ParseError, string>
```

`FetchError` still flows from the main network call, and `ParseError` is added by `text(...)`.

## Next Steps

- Start with [Quick Start](quick-start/).
- Learn how [interceptors](interceptors/) shape requests.
- Use [decoders](decoders/) to parse and validate response bodies.
