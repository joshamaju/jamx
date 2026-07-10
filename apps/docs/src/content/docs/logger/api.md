---
title: API Reference
description: Curated reference for the public @jamx/logger exports.
---

## Severity

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

## LogRecord

```ts
interface LogRecord {
  severity: Severity;
  severityName: string;
  timestamp: Date;
  message: string;
  meta: LogMeta;
}
```

## Core Interfaces

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
```

`flush()` leaves a transport open. `close()` flushes pending records and
releases transport resources. Both methods are optional for synchronous
transports.

## Logger Creation

- `createLogger(options)`: creates a structured logger facade.
- `createNamedLogger(options)`: creates a logger and adds a `logger` metadata field.
- `createChildLogger(logger, meta)`: creates a logger with inherited metadata.
- `createLoggerFacade(logger)`: wraps an existing logger with convenience methods.

## Processors

- `CompositeProcessor`
- `DefaultsProcessor`
- `RedactProcessor`
- `ErrorProcessor`

## Transports

- `ConsoleTransport`
- `MemoryTransport`
- `CompositeTransport`
- `LineConsoleTransport`

`CompositeTransport` forwards lifecycle operations to its resolved child
transports. `LineConsoleTransport` supports `flush()` and `close()` for its
buffered writes.

## Formatters

- `PrettyFormatter`
- `JsonFormatter`
- `TextFormatter`
- `PrintfFormatter`
