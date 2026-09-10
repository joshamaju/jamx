import { Formatter, LogRecord } from "../core.js";
import { safeStringify } from "../shared.js";

export interface JsonFormatterOptions {
  indent?: number | string;
}

export class JsonFormatter implements Formatter {
  constructor(private readonly options: JsonFormatterOptions = {}) {}

  format(log: LogRecord): string {
    return safeStringify(
      {
        timestamp: log.timestamp.toISOString(),
        severity: log.severityName,
        message: log.message,
        meta: log.meta,
      },
      this.options.indent,
    );
  }
}
