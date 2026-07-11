# `@jamx/logger`

Composable structured logging primitives for TypeScript and Node.js.

`@jamx/logger` keeps log creation, convenience methods, processing, formatting,
and output as separate pieces. `CoreLogger` creates structured records,
`Logger` provides a console-like API, optional processors can adjust records,
and transports decide where logs go.

## Install

```bash
pnpm add @jamx/logger
```

## Quick Start

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

## Pipeline

```txt
Logger facade -> CoreLogger severity filter -> Processor -> Transport -> Formatter/output
```

- `Logger` wraps any logger with convenience methods like `info()` and `warn()`.
- `CoreLogger` creates `LogRecord` objects and applies the severity filter.
- `Processor` optionally transforms a `LogRecord` before it reaches a transport.
- `Transport` captures the record and writes or stores it.
- `Formatter` converts a record to text when a transport needs formatted output.

Processors only run for records that pass `minSeverity`.

## Structured Logging

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

## Convenience Logging API

`CoreLogger` exposes the low-level `log(severity, message, meta)` method.
`Logger` wraps any logger with convenience methods similar to `console`,
including `info()`, `warn()`, and `error()`. It also forwards `transport` and
`processor`, so those can still be changed through the facade.

`createLogger` builds a `CoreLogger` and returns it wrapped in `Logger`.
`createNamedLogger` does the same and adds a `logger` metadata field.
`createLoggerFacade` wraps an existing logger. Use `createChildLogger` when a
workflow needs extra inherited metadata.

```ts
import {
  ConsoleTransport,
  createChildLogger,
  createNamedLogger,
  PrettyFormatter,
  Severity,
} from "@jamx/logger";

const logger = createNamedLogger({
  name: "worker",
  minSeverity: Severity.Info,
  meta: { queue: "emails" },
  transport: new ConsoleTransport(new PrettyFormatter()),
});

const requestLogger = createChildLogger(logger, {
  requestId: "req_42",
});

const jobLogger = createChildLogger(requestLogger, {
  jobId: "job_7",
});

jobLogger.info("Job started");
jobLogger.warn("Job retry scheduled", { attempt: 2 });
```

## Processors

Processors are useful for redaction, enrichment, normalization, or deriving
metadata before a transport sees the record.

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

Built-in processors:

- `CompositeProcessor`: runs multiple processors in order.
- `DefaultsProcessor`: adds default metadata without overwriting existing keys.
- `RedactProcessor`: replaces values for configured metadata keys without
  changing field names.
- `ErrorProcessor`: normalizes `Error` values in metadata.

## Transports And Formatters

Built-in transports:

- `ConsoleTransport`: writes formatted logs to `console.log` or `console.error`.
- `WriterTransport`: sends formatted output and its record to a synchronous
  runtime-neutral writer callback.
- `MemoryTransport`: stores records in memory for tests or inspection.
- `CompositeTransport`: fans out one record to multiple transports.
- `LineConsoleTransport`: updates stable terminal lines using `lineId` metadata.

Built-in formatters:

- `PrettyFormatter`: human-readable console output.
- `JsonFormatter`: JSON lines for structured output.
- `TextFormatter`: compact text output.
- `PrintfFormatter`: printf-style message interpolation with metadata values.

Custom formatters implement `Formatter`:

```ts
import { Formatter, LogRecord } from "@jamx/logger";

class CompactFormatter implements Formatter {
  format(log: LogRecord): string {
    return `${log.severityName.toUpperCase()}: ${log.message}`;
  }
}
```

Custom transports implement `Transport`:

```ts
import { LogRecord, Transport } from "@jamx/logger";

class ArrayTransport implements Transport {
  readonly logs: LogRecord[] = [];

  capture(log: LogRecord): void {
    this.logs.push(log);
  }
}
```

Transports that buffer or asynchronously deliver records can optionally expose
`flush()` and `close()`. `flush()` waits for pending records while leaving the
transport usable. `close()` must flush pending records, release resources, and
be safe to call more than once.

```ts
await logger.transport.flush?.();
await logger.transport.close?.();
```

`CompositeTransport` propagates both operations to every resolved child
transport and isolates individual child failures.

Use `WriterTransport` when output should go somewhere other than the JavaScript
console. The callback receives the formatted output without an added newline
and the original structured record:

```ts
import { JsonFormatter, WriterTransport } from "@jamx/logger";

const transport = new WriterTransport(
  new JsonFormatter(),
  (output) => process.stderr.write(`${output}\n`),
);
```

`ConsoleTransport` remains a convenience specialization that routes warnings
and errors to `console.error` and lower severities to `console.log`.

## Examples

Run examples from this package directory:

```bash
pnpm run example:basic
pnpm run example:structured
pnpm run example:writer-pretty
pnpm run example:context
pnpm run example:processor
pnpm run example:memory
pnpm run example:composite
pnpm run example:formatter
pnpm run example:printf
pnpm run example:line
pnpm run example:worker
```

The example files live in `example/`:

- `basic.ts`: named console logger with pretty output.
- `structured.ts`: JSON output and structured metadata.
- `writer-pretty.ts`: pretty output written to stderr with `WriterTransport`.
- `context.ts`: inherited metadata with child loggers.
- `processor.ts`: redaction and enrichment with a processor.
- `memory.ts`: capture logs in memory.
- `composite-transport.ts`: write one record to multiple transports.
- `custom-formatter.ts`: implement a formatter.
- `printf.ts`: format messages with printf-style placeholders.
- `line-console.ts`: update stable terminal lines.
- `worker/`: advanced Node worker transport with a bounded pending-record
  count, delivery acknowledgements, flush boundaries, and graceful shutdown.

## API Reference

### `Severity`

```ts
enum Severity {
  Silly = 0,
  Trace = 1,
  Debug = 2,
  Info = 3,
  Warn = 4,
  Error = 5,
  Fatal = 6,
}
```

### `LogRecord`

```ts
interface LogRecord {
  severity: Severity;
  severityName: string;
  timestamp: Date;
  message: string;
  meta: LogMeta;
}
```

### `LoggerOptions`

Options for `createLogger`, `createNamedLogger`, `CoreLogger`, and
`createCoreLogger`.

```ts
interface LoggerOptions {
  meta?: LogMeta;
  clock?: () => Date;
  transport: Transport;
  processor?: Processor;
  minSeverity?: Severity;
}
```

### `NamedLoggerOptions`

```ts
interface NamedLoggerOptions extends LoggerOptions {
  name: string;
}
```

### Core Interfaces

```ts
type LogMeta = Record<string, unknown>;

interface Processor {
  process(log: LogRecord): LogRecord;
}

interface Transport {
  formatter?: Formatter;
  capture(log: LogRecord): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

interface Formatter {
  format(log: LogRecord): string;
}

type LogWriter = (output: string, log: LogRecord) => void;
```

### Constructors And Helpers

```ts
class CoreLogger implements ILogger {}

class Logger implements ILogger {
  silly(message: string, meta?: LogMeta): void;
  trace(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  fatal(message: string, meta?: LogMeta): void;
}

function createCoreLogger(options: LoggerOptions): CoreLogger;
function createLogger(options: LoggerOptions): Logger;
function createNamedLogger(options: NamedLoggerOptions): Logger;
function createLoggerFacade(logger: ILogger, meta?: LogMeta): Logger;
function createChildLogger(logger: ILogger, meta: LogMeta): Logger;
```

## Exports

Most consumers should import from the root package:

```ts
import {
  ConsoleTransport,
  CoreLogger,
  Logger,
  CompositeProcessor,
  createChildLogger,
  createCoreLogger,
  createLogger,
  createNamedLogger,
  DefaultsProcessor,
  ErrorProcessor,
  JsonFormatter,
  LineConsoleTransport,
  MemoryTransport,
  PrettyFormatter,
  PrintfFormatter,
  RedactProcessor,
  Severity,
  WriterTransport,
} from "@jamx/logger";
```

Explicit subpath exports are also available:

- `@jamx/logger/Logger`
- `@jamx/logger/Formatter`
- `@jamx/logger/Processor`
- `@jamx/logger/Transport`

## Development

```bash
pnpm run typecheck
pnpm run typecheck:examples
pnpm test
```

## Benchmarks

Run the internal regression suite or the informational Pino/Winston comparison:

```bash
pnpm run benchmark
pnpm run benchmark:comparison
pnpm run benchmark:worker
```

Benchmarks use in-memory sinks and are not enforced as exact CI performance
thresholds. See `benchmark/README.md` for methodology and interpretation.
