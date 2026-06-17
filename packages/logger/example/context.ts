import {
  ConsoleTransport,
  createContextLogger,
  createNamedLogger,
  PrettyFormatter,
  Severity,
} from "../src/index.js";

const logger = createNamedLogger({
  name: "worker",
  minSeverity: Severity.Info,
  meta: { queue: "emails" },
  transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
});

const requestLogger = createContextLogger(logger, {
  requestId: "req_42",
}).child({
  jobId: "job_7",
});

requestLogger.info("Job started");
requestLogger.warn("Job retry scheduled", { attempt: 2 });
