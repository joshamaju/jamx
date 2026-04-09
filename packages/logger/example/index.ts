import {
  CompositeTransport,
  ConsoleTransport,
  createContextLogger,
  createLogger,
  createNamedLogger,
  Formatter,
  JsonFormatter,
  LineConsoleTransport,
  Logger,
  LogRecord,
  MemoryTransport,
  PrettyFormatter,
  Severity,
  TextFormatter,
} from "../src/index.js";
import spinner from "elegant-spinner";

// const app_logger = createNamedLogger({
//   name: "app",
//   minSeverity: Severity.Debug,
//   transport: new ConsoleTransport(new PrettyFormatter()),
// });

// app_logger.info("Application started", {
//   env: "development",
//   version: "1.0.0",
// });

// app_logger.error("Failed to load config", {
//   file: "./config.json",
//   error: new Error("ENOENT"),
// });

// const memory_transport = new MemoryTransport();

// const combinedTransport = new CompositeTransport([
//   new ConsoleTransport(new JsonFormatter()),
//   memory_transport,
// ]);

// const api_logger = new Logger({
//   minSeverity: Severity.Trace,
//   transport: combinedTransport,
//   meta: {
//     service: "logger-v2",
//   },
// });

// api_logger.log(Severity.Debug, "Incoming request", {
//   method: "GET",
//   path: "/health",
//   requestId: "req_123",
// });

// const request_logger = createContextLogger(api_logger, { logger: "api" }).child(
//   { requestId: "req_123", userId: "user_42" },
// );

// request_logger.info("Request completed", {
//   statusCode: 200,
//   durationMs: 18,
// });

// const og_transport = request_logger.transport;
// const og_formatter = og_transport.formatter;

// request_logger.transport = new MemoryTransport();

// request_logger.info("Switched transport");

// // @ts-expect-error
// console.log(request_logger.transport.logs);

// request_logger.transport = og_transport;

// request_logger.debug("Switched transport back");

// const worker_logger = createLogger({
//   minSeverity: Severity.Info,
//   transport: new ConsoleTransport(new TextFormatter()),
//   meta: {
//     logger: "worker",
//     queue: "emails",
//   },
// });

// worker_logger.log(Severity.Warn, "Retrying job", {
//   jobId: "job_99",
//   attempt: 2,
// });

// console.log("Buffered logs:", memory_transport.logs);

const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";
const ANSI_MAGENTA = "\u001b[35m";

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case Severity.Silly:
      return ANSI_DIM;
    case Severity.Trace:
      return ANSI_CYAN;
    case Severity.Debug:
      return ANSI_BLUE;
    case Severity.Info:
      return ANSI_GREEN;
    case Severity.Warn:
      return ANSI_YELLOW;
    case Severity.Error:
      return ANSI_RED;
    case Severity.Fatal:
      return ANSI_MAGENTA;
    default:
      return "";
  }
}

function maybeColorize(
  value: string,
  color: string,
  colorize: boolean,
): string {
  return colorize ? `${color}${value}${ANSI_RESET}` : value;
}

class MyPrettyFormatter implements Formatter {
  format(log: LogRecord): string {
    const colorize = true;
    const severityLabel = log.severityName.toUpperCase().padEnd(5, " ");

    const severity = maybeColorize(
      severityLabel,
      getSeverityColor(log.severity),
      colorize,
    );

    const timestamp = maybeColorize(
      log.timestamp.toISOString(),
      ANSI_DIM,
      colorize,
    );

    const metaOutput =
      Object.entries(log.meta).length > 0
        ? ` ${maybeColorize("|", ANSI_DIM, colorize)} ${Object.entries(log.meta)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ")}`
        : "";

    const pieces = [severity, log.message];

    return `${pieces.join(" ")}${metaOutput}`;
  }
}

const task_logger = createNamedLogger({
  name: "tasks",
  minSeverity: Severity.Debug,
  transport: new LineConsoleTransport({
    formatter: new MyPrettyFormatter(),
    interactive: true,
  }),
});

task_logger.info("Syncing user", { lineId: "user_42" });

task_logger.info("waiting for organization response...");

task_logger.info("Fetching organization", { lineId: "org_12" });

await new Promise((r) => setTimeout(r, 2000));

task_logger.info("Syncing user...", { lineId: "user_42" });

await new Promise((r) => setTimeout(r, 2000));

task_logger.error("Fetched organization", {
  lineId: "org_12",
  finalize: true,
});

await new Promise((r) => setTimeout(r, 2000));

task_logger.debug("Synced user", {
  lineId: "user_42",
  finalize: true,
});

for (let i = 0; i < 10; i++) {
  const frame = spinner();
  const id = `spinner_${i}`;

  const message = () => `${frame()} Loading.... ${i}`;

  const interval = setInterval(() => {
    task_logger.info(message(), { lineId: id });
  }, 60);

  new Promise((r) => setTimeout(r, 10000)).then(() => {
    clearInterval(interval);
    task_logger.info(`Finished loading ${i}`, { lineId: id, finalize: true });
  });
}
