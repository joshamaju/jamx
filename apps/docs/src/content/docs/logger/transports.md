---
title: Transports And Formatters
description: Send log records to outputs and format them for display.
---

Transports capture log records. Formatters convert records to text when a transport needs formatted output.

## Built-In Transports

- `ConsoleTransport`: writes formatted logs to `console.log` or `console.error`.
- `MemoryTransport`: stores records in memory for tests or inspection.
- `CompositeTransport`: fans out one record to multiple transports.
- `LineConsoleTransport`: updates stable terminal lines using `lineId` metadata.

## Built-In Formatters

- `PrettyFormatter`: human-readable console output.
- `JsonFormatter`: JSON lines for structured output.
- `TextFormatter`: compact text output.

## Custom Formatter

```ts
import { Formatter, LogRecord } from "@jamx/logger";

class CompactFormatter implements Formatter {
  format(log: LogRecord): string {
    return `${log.severityName.toUpperCase()}: ${log.message}`;
  }
}
```

## Custom Transport

```ts
import { LogRecord, Transport } from "@jamx/logger";

class ArrayTransport implements Transport {
  readonly logs: LogRecord[] = [];

  capture(log: LogRecord): void {
    this.logs.push(log);
  }
}
```
