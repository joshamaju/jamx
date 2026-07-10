---
title: Processors
description: Transform, enrich, or redact log records before output.
---

Processors are useful for redaction, enrichment, normalization, or deriving metadata before a transport sees the record.

```ts
import {
  ConsoleTransport,
  CompositeProcessor,
  createNamedLogger,
  DefaultsProcessor,
  PrettyFormatter,
  RedactProcessor,
  Severity,
} from "@jamx/logger";

const logger = createNamedLogger({
  name: "auth",
  minSeverity: Severity.Info,
  processor: new CompositeProcessor([
    new DefaultsProcessor({ source: "auth" }),
    new RedactProcessor(["token"]),
  ]),
  transport: new ConsoleTransport(new PrettyFormatter()),
});
```

The processor can also be swapped at runtime:

```ts
logger.processor = undefined;
```

## Built-In Processors

- `CompositeProcessor`: runs multiple processors in order.
- `DefaultsProcessor`: adds default metadata without overwriting existing keys.
- `RedactProcessor`: replaces values for configured metadata keys without changing field names.
- `ErrorProcessor`: normalizes `Error` values in metadata.

`RedactProcessor` walks nested objects and arrays, preserves circular object
graphs safely, and does not mutate the original metadata. Configure every key
that may contain sensitive information:

```ts
new RedactProcessor(["password", "token", "authorization", "apiKey"]);
```

Processor failures fall back to the original record. Put redaction before other
custom processors when sensitive metadata must be removed before further
processing.
