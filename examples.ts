import {
  CompositeTransport,
  ConsoleTransport,
  createContextLogger,
  createLogger,
  createNamedLogger,
  createTaskLogger,
  JsonFormatter,
  Logger,
  MemoryTransport,
  PrettyFormatter,
  Severity,
  TaskConsoleTransport,
  TextFormatter,
} from "./index.js";

const appLogger = createNamedLogger({
  name: "app",
  minSeverity: Severity.Debug,
  transport: new ConsoleTransport(new PrettyFormatter()),
});

appLogger.info("Application started", {
  env: "development",
  version: "1.0.0",
});

appLogger.error("Failed to load config", {
  file: "./config.json",
  error: new Error("ENOENT"),
});

const memoryTransport = new MemoryTransport();

const combinedTransport = new CompositeTransport([
  new ConsoleTransport(new JsonFormatter()),
  memoryTransport,
]);

const apiLogger = new Logger({
  minSeverity: Severity.Trace,
  transport: combinedTransport,
  meta: {
    service: "logger-v2",
  },
});

apiLogger.log(Severity.Debug, "Incoming request", {
  method: "GET",
  path: "/health",
  requestId: "req_123",
});

const requestLogger = createContextLogger(apiLogger, {
  logger: "api",
}).child({
  requestId: "req_123",
  userId: "user_42",
});

requestLogger.info("Request completed", {
  statusCode: 200,
  durationMs: 18,
});

const workerLogger = createLogger({
  minSeverity: Severity.Info,
  transport: new ConsoleTransport(new TextFormatter()),
  meta: {
    logger: "worker",
    queue: "emails",
  },
});

workerLogger.log(Severity.Warn, "Retrying job", {
  jobId: "job_99",
  attempt: 2,
});

console.log("Buffered logs:", memoryTransport.logs);

const taskLogger = createTaskLogger(
  createNamedLogger({
    name: "tasks",
    transport: new TaskConsoleTransport({
      formatter: new PrettyFormatter({ colorize: false }),
      colorize: false,
      interactive: true,
    }),
  }),
);

const userSyncTask = taskLogger.start("Syncing user", {
  meta: {
    userId: "user_42",
  },
});

await new Promise((r) => setTimeout(r, 3000));

userSyncTask.update("Syncing user", {
  progress: "50%",
});

userSyncTask.success("Synced user", {
  durationMs: 120,
});
