import { Formatter, LogRecord, Severity } from "../core.js";
import { safeStringify } from "../shared.js";

export interface PrettyFormatterOptions {
  colorize?: boolean;
}

function formatMetaValue(value: unknown): string {
  if (typeof value === "string") {
    return /\s/.test(value) ? JSON.stringify(value) : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return safeStringify(value);
}

const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";
const ANSI_MAGENTA = "\u001b[35m";

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case Severity.Silly:
      return ANSI_DIM;
    case Severity.Trace:
      return ANSI_CYAN;
    case Severity.Debug:
      return ANSI_BLUE;
    case Severity.Info:
      return ANSI_GREEN;
    case Severity.Warn:
      return ANSI_YELLOW;
    case Severity.Error:
      return ANSI_RED;
    case Severity.Fatal:
      return ANSI_MAGENTA;
    default:
      return "";
  }
}

function maybeColorize(
  value: string,
  color: string,
  colorize: boolean,
): string {
  return colorize ? `${color}${value}${ANSI_RESET}` : value;
}

export class PrettyFormatter implements Formatter {
  constructor(private readonly options: PrettyFormatterOptions = {}) {}

  format(log: LogRecord): string {
    const colorize = this.options.colorize ?? true;
    const severityLabel = log.severityName.toUpperCase().padEnd(5, " ");

    const severity = maybeColorize(
      severityLabel,
      getSeverityColor(log.severity),
      colorize,
    );

    const timestamp = maybeColorize(
      log.timestamp.toISOString(),
      ANSI_DIM,
      colorize,
    );

    const metaOutput =
      Object.entries(log.meta).length > 0
        ? ` ${maybeColorize("|", ANSI_DIM, colorize)} ${Object.entries(log.meta)
            .map(([key, value]) => `${key}=${formatMetaValue(value)}`)
            .join(" ")}`
        : "";

    const pieces = [timestamp, severity, log.message];

    return `${pieces.join(" ")}${metaOutput}`;
  }
}
