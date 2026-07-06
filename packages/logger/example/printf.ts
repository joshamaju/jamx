import {
  ConsoleTransport,
  createLogger,
  PrintfFormatter,
  Severity,
} from "../src/index.js";

const logger = createLogger({
  minSeverity: Severity.Debug,
  transport: new ConsoleTransport(new PrintfFormatter()),
});

logger.log(Severity.Info, "request %s completed in %dms", {
  requestId: "req_123",
  durationMs: 18,
});

logger.log(Severity.Warn, "retry %d scheduled for %s", {
  attempt: 2,
  requestId: "req_124",
});
