---
title: Decoders
description: Decode and validate HTTP responses while preserving upstream errors.
---

Decoder helpers accept either a plain `Response` or an `Either<..., Response>`.

```ts
import {
  decodeJson,
  json,
  text,
  validate,
  type DecodeError,
  type Decoder,
  type Either,
  type ParseError,
  type SchemaError,
} from "@jamx/http";
import { z } from "zod";

interface User {
  id: number;
  name: string;
}

declare const decodeUser: Decoder<User>;

const rawResponse = await fetch("https://api.example.com/users/42");
const userSchema = z.object({ id: z.number(), name: z.string() });

const bodyText = await text(rawResponse);
const bodyJson = await json(rawResponse);
const user = await decodeJson(rawResponse, decodeUser);
const userWithSchema = await validate(bodyJson, userSchema);

type BodyTextResult = Awaited<typeof bodyText>;
// Either<ParseError, string>

type BodyJsonResult = Awaited<typeof bodyJson>;
// Either<ParseError, unknown>

type UserResult = Awaited<typeof user>;
// Either<ParseError | DecodeError, User>

type UserWithSchemaResult = Awaited<typeof userWithSchema>;
// Either<ParseError | SchemaError, { id: number; name: string }>
```

When you already have an `Either`, upstream errors are preserved in the helper result type.

```ts
import {
  defaultFetch,
  json,
  type Either,
  type FetchError,
  type ParseError,
} from "@jamx/http";

const response = await defaultFetch("https://api.example.com/users/42");
const parsed = await json(response);

type ParsedResult = Awaited<typeof parsed>;
// Either<FetchError | ParseError, unknown>
```

`json(...)` adds `ParseError`, but the `FetchError` from the original network call is still part of the result.

## Status Validation

Use `expectStatus` before decoding when a handler should only accept specific status codes.

```ts
import {
  defaultFetch,
  decodeJson,
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

const response = await defaultFetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);

type UserResult = Awaited<typeof user>;
// Either<FetchError | StatusError | ParseError | DecodeError, User>
```

## Schema Validation

`validate(result, schema)` accepts an `Either` plus a Standard Schema compatible validator such as Zod.

```ts
import {
  defaultFetch,
  json,
  validate,
  type Either,
  type FetchError,
  type ParseError,
  type SchemaError,
} from "@jamx/http";
import { z } from "zod";

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const response = await defaultFetch("https://api.example.com/users/42");
const parsed = await json(response);
const user = await validate(parsed, userSchema);

type UserResult = Awaited<typeof user>;
// Either<FetchError | ParseError | SchemaError, { id: number; name: string }>
```
