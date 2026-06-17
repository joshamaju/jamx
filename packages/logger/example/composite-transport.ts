import {
  CompositeTransport,
  ConsoleTransport,
  createLogger,
  MemoryTransport,
  PrettyFormatter,
  Severity,
} from "../src/index.js";

const memoryTransport = new MemoryTransport();
const logger = createLogger({
  minSeverity: Severity.Debug,
  transport: new CompositeTransport([
    new ConsoleTransport(new PrettyFormatter({ colorize: true })),
    memoryTransport,
  ]),
});

logger.log(Severity.Info, "Fan-out log captured", {
  requestId: "req_123",
});

console.log("Buffered log count:", memoryTransport.logs.length);
