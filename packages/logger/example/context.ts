import {
  ConsoleTransport,
  createChildLogger,
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

const requestLogger = createChildLogger(logger, {
  requestId: "req_42",
});

const jobLogger = createChildLogger(requestLogger, {
  jobId: "job_7",
});

jobLogger.info("Job started");
jobLogger.warn("Job retry scheduled", { attempt: 2 });
