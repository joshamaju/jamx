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
} from "../src/index.js";

const app_logger = createNamedLogger({
  name: "app",
  minSeverity: Severity.Debug,
  transport: new ConsoleTransport(new PrettyFormatter()),
});

app_logger.info("Application started", {
  env: "development",
  version: "1.0.0",
});

app_logger.error("Failed to load config", {
  file: "./config.json",
  error: new Error("ENOENT"),
});

const memory_transport = new MemoryTransport();

const combinedTransport = new CompositeTransport([
  new ConsoleTransport(new JsonFormatter()),
  memory_transport,
]);

const api_logger = new Logger({
  minSeverity: Severity.Trace,
  transport: combinedTransport,
  meta: {
    service: "logger-v2",
  },
});

api_logger.log(Severity.Debug, "Incoming request", {
  method: "GET",
  path: "/health",
  requestId: "req_123",
});

const request_logger = createContextLogger(api_logger, { logger: "api" }).child(
  { requestId: "req_123", userId: "user_42" },
);

request_logger.info("Request completed", {
  statusCode: 200,
  durationMs: 18,
});

const worker_logger = createLogger({
  minSeverity: Severity.Info,
  transport: new ConsoleTransport(new TextFormatter()),
  meta: {
    logger: "worker",
    queue: "emails",
  },
});

worker_logger.log(Severity.Warn, "Retrying job", {
  jobId: "job_99",
  attempt: 2,
});

console.log("Buffered logs:", memory_transport.logs);

const task_logger = createTaskLogger(
  createNamedLogger({
    name: "tasks",
    transport: new TaskConsoleTransport({
      formatter: new PrettyFormatter({ colorize: false }),
      colorize: false,
      interactive: true,
      prefix: "task",
    }),
  }),
);

const user_sync_task = task_logger.start("Syncing user", {
  meta: {
    userId: "user_42",
  },
});

const org_sync_task = task_logger.start("Fetching organization", {
  meta: {
    orgId: "org_12",
  },
});

await new Promise((r) => setTimeout(r, 800));

user_sync_task.update("Syncing user", {
  progress: "50%",
});

await new Promise((r) => setTimeout(r, 800));

org_sync_task.success("Fetched organization", {
  durationMs: 1600,
});

await new Promise((r) => setTimeout(r, 800));

user_sync_task.success("Synced user", {
  durationMs: 120,
});
