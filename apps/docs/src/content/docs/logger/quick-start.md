---
title: Quick Start
description: Create structured loggers with @jamx/logger.
---

## Create A Named Logger

```ts
import {
  ConsoleTransport,
  createNamedLogger,
  PrettyFormatter,
  Severity,
} from "@jamx/logger";

const logger = createNamedLogger({
  name: "worker",
  minSeverity: Severity.Info,
  transport: new ConsoleTransport(new PrettyFormatter()),
});

logger.info("Job started");
logger.warn("Job retry scheduled", { attempt: 2 });
```

## Add Structured Metadata

`message` is always a string. Put structured data in `meta`.

```ts
import {
  ConsoleTransport,
  createLogger,
  JsonFormatter,
  Severity,
} from "@jamx/logger";

const logger = createLogger({
  minSeverity: Severity.Debug,
  meta: { service: "payments" },
  transport: new ConsoleTransport(new JsonFormatter()),
});

logger.log(Severity.Info, "charge succeeded", {
  chargeId: "ch_42",
  amount: 5000,
  currency: "USD",
});
```

## Create Child Loggers

Use `createChildLogger` when a workflow needs extra inherited metadata.

```ts
import { createChildLogger } from "@jamx/logger";

const requestLogger = createChildLogger(logger, {
  requestId: "req_42",
});

requestLogger.info("Request completed", { durationMs: 18 });
```

## Graceful Shutdown

If the configured transport buffers or asynchronously delivers records, close
it before the process exits:

```ts
logger.info("Worker shutting down");
await logger.transport.close?.();
```

Synchronous transports do not need to implement lifecycle methods. See
[Transports And Formatters](../transports/#transport-lifecycle) for the full
contract.
