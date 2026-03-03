import { Formatter, LogRecord } from "../../Logger.js";
import { safeStringify } from "../shared.js";

export class TextFormatter implements Formatter {
  format(log: LogRecord): string {
    const loggerName =
      typeof log.meta.logger === "string" && log.meta.logger.length > 0
        ? `[${log.meta.logger}]`
        : "";

    const { logger: _logger, ...displayMeta } = log.meta;

    const pieces = [
      log.timestamp.toISOString(),
      `[${log.severityName}]`,
      loggerName,
      log.message,
    ].filter(Boolean);

    const metaOutput =
      Object.keys(displayMeta).length > 0
        ? ` ${safeStringify(displayMeta)}`
        : "";

    return `${pieces.join(" ")}${metaOutput}`;
  }
}
