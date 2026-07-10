---
title: Transports And Formatters
description: Send log records to outputs and format them for display.
---

Transports capture log records. Formatters convert records to text when a transport needs formatted output.

## Built-In Transports

- `ConsoleTransport`: writes formatted logs to `console.log` or `console.error`.
- `WriterTransport`: passes formatted output and the original record to a
  synchronous runtime-neutral callback.
- `MemoryTransport`: stores records in memory for tests or inspection.
- `CompositeTransport`: fans out one record to multiple transports.
- `LineConsoleTransport`: updates stable terminal lines using `lineId` metadata.

## Built-In Formatters

- `PrettyFormatter`: human-readable console output.
- `JsonFormatter`: JSON lines for structured output.
- `TextFormatter`: compact text output.
- `PrintfFormatter`: applies printf-style interpolation without mutating the
  shared log record.

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

## Writer Transport

Use `WriterTransport` to control the output destination without coupling the
transport to Node.js streams, browser consoles, or another runtime API:

```ts
import { JsonFormatter, WriterTransport } from "@jamx/logger";

const transport = new WriterTransport(
  new JsonFormatter(),
  (output, record) => {
    process.stderr.write(`${output}\n`);
  },
);
```

The writer receives formatted output without an added newline and the original
`LogRecord`. This allows severity-based routing without parsing the formatted
text. Writers are synchronous; networked or buffered transports should own
their asynchronous queue and expose the lifecycle methods below.

`ConsoleTransport` is the convenience specialization for the JavaScript
console. It preserves the existing behavior of sending warnings and errors to
`console.error` and lower severities to `console.log`.

`WriterTransport` works with human-readable formatters too:

```ts
import { PrettyFormatter, WriterTransport } from "@jamx/logger";

const transport = new WriterTransport(
  new PrettyFormatter({ colorize: Boolean(process.stderr.isTTY) }),
  (output) => process.stderr.write(`${output}\n`),
);
```

## Transport Lifecycle

Transports that buffer output or deliver records asynchronously can implement
optional lifecycle methods:

```ts
interface Transport {
  formatter?: Formatter;
  capture(log: LogRecord): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
```

- `flush()` waits for records currently queued by the transport and leaves the
  transport usable.
- `close()` flushes pending records, releases resources, and should be safe to
  call more than once.

Call lifecycle methods through the logger's transport during graceful
shutdown:

```ts
logger.info("Server shutting down");
await logger.transport.close?.();
```

Use `flush()` when you need a delivery boundary but intend to continue logging:

```ts
logger.info("Import checkpoint complete", { imported: 500 });
await logger.transport.flush?.();
```

`CompositeTransport` propagates `flush()` and `close()` to every resolved child
transport using best-effort settlement. A failed child does not prevent the
others from completing. When a child has no `close()`, the composite calls its
`flush()` during shutdown.

`LineConsoleTransport` implements both methods because it batches terminal
writes in a microtask. After it or a `CompositeTransport` is closed, subsequent
records are ignored.

Lifecycle completion reflects each transport's own delivery guarantee. For
example, an HTTP transport may consider a record delivered after the remote
collector acknowledges it; `close()` cannot guarantee storage beyond that
contract.
