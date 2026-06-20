---
title: "@jamx/logger"
description: Composable structured logging primitives for TypeScript and Node.js.
---

`@jamx/logger` keeps log creation, convenience methods, processing, formatting, and output as separate pieces.

`CoreLogger` creates structured records, `Logger` provides a console-like API, processors can adjust records, and transports decide where logs go.

## Install

```bash
pnpm add @jamx/logger
```

## Quick Example

```ts
import {
  ConsoleTransport,
  createNamedLogger,
  PrettyFormatter,
  Severity,
} from "@jamx/logger";

const logger = createNamedLogger({
  name: "api",
  minSeverity: Severity.Info,
  transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
});

logger.info("Request completed", {
  requestId: "req_123",
  durationMs: 18,
});
```

## Next Steps

- Start with [Quick Start](/logger/quick-start/).
- Learn the [logging pipeline](/logger/pipeline/).
- Add [processors](/logger/processors/) for redaction and enrichment.
- Choose [transports and formatters](/logger/transports/) for output.
