---
title: Decoders
description: Decode and validate HTTP responses while preserving upstream errors.
---

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

When you already have an `Either`, upstream errors are preserved in the helper result type.

## Status Validation

Use `expectStatus` before decoding when a handler should only accept specific status codes.

```ts
import { decodeJson, expectStatus } from "@jamx/http";

const response = await fetch("https://api.example.com/users/42");
const user = await decodeJson(expectStatus(response, 200), decodeUser);
```

## Schema Validation

`validate(result, schema)` accepts an `Either` plus a Standard Schema compatible validator such as Zod.

```ts
import { json, validate } from "@jamx/http";
import { z } from "zod";

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const parsed = await json(response);
const user = await validate(parsed, userSchema);
```
