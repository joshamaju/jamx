import {
  ConsoleTransport,
  createLogger,
  Formatter,
  LogRecord,
  Severity,
} from "../src/index.js";

class CompactFormatter implements Formatter {
  format(log: LogRecord): string {
    const scope =
      typeof log.meta.scope === "string" && log.meta.scope.length > 0
        ? ` ${log.meta.scope}`
        : "";

    return `${log.severityName.toUpperCase()}${scope}: ${log.message}`;
  }
}

const logger = createLogger({
  transport: new ConsoleTransport(new CompactFormatter()),
});

logger.log(Severity.Info, "Formatter selected", { scope: "cli" });
