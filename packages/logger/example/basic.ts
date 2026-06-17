import {
  ConsoleTransport,
  createNamedLogger,
  PrettyFormatter,
  Severity,
} from "../src/index.js";

const logger = createNamedLogger({
  name: "api",
  minSeverity: Severity.Debug,
  transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
});

logger.info("Request completed", {
  requestId: "req_123",
  durationMs: 18,
});

logger.warn("Request retried", {
  requestId: "req_124",
  attempt: 2,
});
