import {
  ConsoleTransport,
  createNamedLogger,
  LogMeta,
  LogRecord,
  PrettyFormatter,
  Processor,
  Severity,
} from "../src/index.js";

class RedactionProcessor implements Processor {
  process(log: LogRecord): LogRecord {
    const meta: LogMeta = { ...log.meta, source: "processor-example" };

    if (typeof meta.token === "string") {
      meta.token = "[redacted]";
    }

    return { ...log, meta };
  }
}

const logger = createNamedLogger({
  name: "auth",
  minSeverity: Severity.Info,
  processor: new RedactionProcessor(),
  transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
});

logger.info("Session created", {
  userId: "user_42",
  token: "secret-token",
});
