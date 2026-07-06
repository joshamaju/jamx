import {
  CompositeTransport,
  ConsoleTransport,
  createLogger,
  JsonFormatter,
  MemoryTransport,
  PrettyFormatter,
  Severity,
} from "../src/index.js";

const memoryTransport = new MemoryTransport();
const consoleTransport = new ConsoleTransport(
  new PrettyFormatter({ colorize: true }),
);

const logger = createLogger({
  minSeverity: Severity.Debug,
  transport: new CompositeTransport([consoleTransport, memoryTransport]),
});

logger.log(Severity.Info, "Fan-out log captured", {
  requestId: "req_123",
});

console.log("Buffered log count:", memoryTransport.logs.length);

const logger_ = createLogger({
  minSeverity: Severity.Debug,
  transport: new CompositeTransport([
    ({ severity }) => (severity !== Severity.Error ? consoleTransport : null),
    ({ severity }) =>
      severity == Severity.Error
        ? new ConsoleTransport(new JsonFormatter())
        : null,
  ]),
});

logger_.log(Severity.Info, "Log captured", {
  requestId: "req_123",
});

logger_.log(Severity.Error, "Fan-out error log captured", {
  requestId: "req_123",
});
