---
title: Quick Start
description: Create a composed fetch handler with @jamx/http.
---

## Create A Handler

```ts
import {
  compose,
  defaultFetch,
  type DecodeError,
  type Decoder,
  type Either,
  type FetchError,
  type ParseError,
  type StatusError,
  type TimeoutError,
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

type ApiResult = Awaited<ReturnType<typeof api>>;
// Either<FetchError | TimeoutError, Response>
```

`compose(...)` applies interceptors before the terminal fetch handler. Use it to build a reusable client for an API boundary. The handler result remains typed: network failures from `defaultFetch` and timeout failures from `withTimeout` both stay visible in the final result type.

## Use Core Fetch APIs

```ts
import {
  createFetchHandler,
  decodeJson,
  defaultContext,
  defaultFetch,
  expectStatus,
  type DecodeError,
  type Decoder,
  type Either,
  type FetchError,
  type ParseError,
  type StatusError,
} from "@jamx/http";

interface User {
  id: number;
  name: string;
}

declare const decodeUser: Decoder<User>;

const customFetch = createFetchHandler(defaultContext);

const response = await defaultFetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);

type ResponseResult = Awaited<typeof response>;
// Either<FetchError, Response>

type UserResult = Awaited<typeof user>;
// Either<FetchError | StatusError | ParseError | DecodeError, User>
```

- `defaultContext` is backed by `globalThis.fetch`.
- `defaultFetch` is `createFetchHandler(defaultContext)`.
- `createFetchHandler(...)` is useful for mocked or custom fetch implementations.
