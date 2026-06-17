import { createLogger, MemoryTransport, Severity } from "../src/index.js";

const transport = new MemoryTransport();
const logger = createLogger({
  meta: { service: "reports" },
  transport,
});

logger.log(Severity.Info, "Report queued", { reportId: "rep_1" });
logger.log(Severity.Error, "Report failed", {
  reportId: "rep_2",
  reason: "timeout",
});

console.log(transport.logs);
