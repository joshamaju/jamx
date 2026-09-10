import {
  ConsoleTransport,
  createNamedLogger,
  JsonFormatter,
  Severity,
} from "../src/index.js";

const logger = createNamedLogger({
  name: "api",
  minSeverity: Severity.Debug,
  transport: new ConsoleTransport(new JsonFormatter({ indent: 2 })),
});

logger.info("Request completed", {
  requestId: "req_123",
  durationMs: 18,
  response: {
    status: 200,
    cached: false,
  },
});
