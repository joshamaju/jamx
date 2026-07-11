# @jamx/logger

## 0.3.0

### Minor Changes

- 943352e: Add `WriterTransport`, a runtime-neutral formatted transport that sends output and the original `LogRecord` to an injected synchronous writer callback.
- d769a11: Rename the logger classes.`Logger` is now the convenience facade with level-specific methods like`info()`, `warn()`, and `error()`. The previous low-level `Logger`implementation is now `CoreLogger`, available through `createCoreLogger`.`ContextLogger`, `createContextLogger`, and the `.child()` method have beenremoved. Use `createChildLogger(logger, meta)` to derive a logger withadditional metadata.

### Patch Changes

- 3f9b18b: CompositeTransport now accepts resolver functions that can choose a transport per log record
- e05a0f9: Add built-in log processors.

  Adds `CompositeProcessor`, `DefaultsProcessor`, `RedactProcessor`, and `ErrorProcessor`, plus a new `@jamx/logger/Processor` subpath export. These processors support composing processor pipelines, adding default metadata, redacting configured metadata values without changing field names, and normalizing `Error` values.

- 4c42eb1: Add optional `flush()` and `close()` lifecycle methods to transports.
- da54793: Add log record processor support
- 789b9a7: Add PrintfFormatter backed by @paydirt/fmt for printf-style message interpolation.
- 5eba292: Make logging failures safe and harden metadata redaction processing

## 0.2.0

### Minor Changes

- 58025bc: Adds terminal/TTY line printer transport. Useful for doing task like logging i.e updating a previous log line

## 0.1.0

### Minor Changes

- 9e6b5a8: Adds logger package
