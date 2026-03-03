import { Formatter, LogRecord } from "../core.js";
import { safeStringify } from "../shared.js";

export class JsonFormatter implements Formatter {
  format(log: LogRecord): string {
    return safeStringify({
      timestamp: log.timestamp.toISOString(),
      severity: log.severityName,
      message: log.message,
      meta: log.meta,
    });
  }
}
