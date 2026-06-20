---
title: Quick Start
description: Create a composed fetch handler with @jamx/http.
---

## Create A Handler

```ts
import {
  compose,
  defaultFetch,
  withBaseUrl,
  withHeaders,
  withRetry,
  withTimeout,
} from "@jamx/http";

const api = compose(
  withTimeout(500),
  withBaseUrl("https://api.example.com/v1"),
  withHeaders({ accept: "application/json" }),
  withRetry({ retries: 1 }),
)(defaultFetch);

const response = await api("/users/42");
```

`compose(...)` applies interceptors before the terminal fetch handler. Use it to build a reusable client for an API boundary.

## Use Core Fetch APIs

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

- `defaultContext` is backed by `globalThis.fetch`.
- `defaultFetch` is `createFetchHandler(defaultContext)`.
- `createFetchHandler(...)` is useful for mocked or custom fetch implementations.
