---
title: Pipeline
description: Understand how records move through @jamx/logger.
---

```txt
Logger facade -> CoreLogger severity filter -> Processor -> Transport -> Formatter/output
```

## Parts

- `Logger` wraps any logger with convenience methods like `info()` and `warn()`.
- `CoreLogger` creates `LogRecord` objects and applies the severity filter.
- `Processor` optionally transforms a `LogRecord` before it reaches a transport.
- `Transport` captures the record and writes or stores it.
- `Formatter` converts a record to text when a transport needs formatted output.

Processors only run for records that pass `minSeverity`.

## Convenience API

`CoreLogger` exposes the low-level `log(severity, message, meta)` method. `Logger` wraps any logger with convenience methods similar to `console`, including `info()`, `warn()`, and `error()`.

`createLogger` builds a `CoreLogger` and returns it wrapped in `Logger`. `createNamedLogger` does the same and adds a `logger` metadata field. `createLoggerFacade` wraps an existing logger.
