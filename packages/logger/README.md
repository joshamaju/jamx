# `@jamx/logger`

Composable logging primitives for TypeScript and Node.js.

The package is split into a small core and optional convenience layers:

- `Logger` is the low-level orchestrator. It creates log records, filters by severity, and hands records to a transport.
- `ContextLogger` wraps any `ILogger` and adds contextual metadata plus convenience methods like `info()` and `error()`.
- formatters and transports are separate building blocks, so output strategy stays composable.

## Install

```bash
pnpm add @jamx/logger
```

## Basic Usage

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
  transport: new ConsoleTransport(
    new PrettyFormatter({ colorize: true }),
  ),
});

logger.info("Request completed", {
  requestId: "req_123",
  durationMs: 18,
});
```

## Structured Logging

`message` is always a string. Structured data belongs in `meta`.

```ts
import {
  JsonFormatter,
  ConsoleTransport,
  createLogger,
  Severity,
} from "@jamx/logger";

const logger = createLogger({
  transport: new ConsoleTransport(new JsonFormatter()),
  minSeverity: Severity.Debug,
  meta: { service: "payments" },
});

logger.log(Severity.Info, "charge succeeded", {
  chargeId: "ch_42",
  amount: 5000,
  currency: "USD",
});
```

## Task Logging

The package also ships with a task-oriented console transport and helper wrapper for async work:

```ts
import {
  createNamedLogger,
  createTaskLogger,
  PrettyFormatter,
  TaskConsoleTransport,
} from "@jamx/logger";

const taskLogger = createTaskLogger(
  createNamedLogger({
    name: "tasks",
    transport: new TaskConsoleTransport({
      formatter: new PrettyFormatter({ colorize: false }),
      interactive: true,
      prefix: "task",
    }),
  }),
);

const task = taskLogger.start("Syncing user", {
  meta: { userId: "user_42" },
});

task.update("Syncing user", { progress: "50%" });
task.success("Synced user", { durationMs: 120 });
```

## Exports

The root package export is intended for most consumers:

```ts
import {
  Logger,
  createLogger,
  createNamedLogger,
  PrettyFormatter,
  TaskConsoleTransport,
} from "@jamx/logger";
```

There are also explicit subpath exports for:

- `@jamx/logger/Logger`
- `@jamx/logger/Formatter`
- `@jamx/logger/Transport`
