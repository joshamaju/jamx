---
title: "@jamx/http"
description: Composable HTTP helpers built around fetch, interceptors, and Either-style results.
---

`@jamx/http` provides a small set of composable helpers for building `fetch` workflows. It keeps request shaping, response handling, decoding, retries, caching, and validation as separate pieces that can be composed as needed.

## Install

```bash
pnpm add @jamx/http
```

## Core Ideas

- Compose request behavior with interceptors.
- Keep requests in a normalized shape until the terminal fetch handler runs.
- Decode and validate responses through helpers that preserve upstream errors.
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

## Next Steps

- Start with [Quick Start](/http/quick-start/).
- Learn how [interceptors](/http/interceptors/) shape requests.
- Use [decoders](/http/decoders/) to parse and validate response bodies.
