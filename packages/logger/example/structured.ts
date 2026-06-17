import {
  ConsoleTransport,
  createLogger,
  JsonFormatter,
  Severity,
} from "../src/index.js";

const logger = createLogger({
  minSeverity: Severity.Debug,
  meta: { service: "payments" },
  transport: new ConsoleTransport(new JsonFormatter()),
});

logger.log(Severity.Debug, "charge request received", {
  chargeId: "ch_42",
  amount: 5000,
  currency: "USD",
});

logger.log(Severity.Info, "charge succeeded", {
  chargeId: "ch_42",
  processorResponseMs: 74,
});
