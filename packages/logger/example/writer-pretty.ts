import {
  createNamedLogger,
  PrettyFormatter,
  Severity,
  WriterTransport,
} from "../src/index.js";

const transport = new WriterTransport(
  new PrettyFormatter({ colorize: Boolean(process.stderr.isTTY) }),
  (output) => process.stderr.write(`${output}\n`),
);

const logger = createNamedLogger({
  minSeverity: Severity.Debug,
  name: "worker",
  transport,
});

logger.info("Job completed", {
  jobId: "job_42",
  durationMs: 87,
});

logger.warn("Retry scheduled", {
  jobId: "job_43",
  attempt: 2,
});
