export enum Severity {
  Silly = 0,
  Trace = 1,
  Debug = 2,
  Info = 3,
  Warn = 4,
  Error = 5,
  Fatal = 6,
}

export type LogMeta = Record<string, unknown>;

export interface LogRecord {
  severity: Severity;
  severityName: string;
  timestamp: Date;
  message: string;
  meta: LogMeta;
}

export interface ILogger {
  log(severity: Severity, message: string, meta?: LogMeta): void;
}

export interface Transport {
  capture(log: LogRecord): void;
}

export interface Formatter {
  format(log: LogRecord): string;
}

export interface LoggerOptions {
  minSeverity?: Severity;
  meta?: LogMeta;
  transport: Transport;
  clock?: () => Date;
}

export interface NamedLoggerOptions extends LoggerOptions {
  name: string;
}

export interface PrettyFormatterOptions {
  colorize?: boolean;
}

export const DEFAULT_CLOCK = () => new Date();

export function getSeverityName(severity: Severity): string {
  return Severity[severity]?.toLowerCase() ?? "unknown";
}

export function isPlainObject(value: unknown): value is LogMeta {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
}

export function assertMeta(
  value: unknown,
  label: string,
): asserts value is LogMeta {
  if (!isPlainObject(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_, nestedValue: unknown) => {
    if (nestedValue instanceof Error) {
      return {
        name: nestedValue.name,
        message: nestedValue.message,
        stack: nestedValue.stack,
      };
    }

    if (typeof nestedValue === "bigint") {
      return nestedValue.toString();
    }

    if (nestedValue && typeof nestedValue === "object") {
      if (seen.has(nestedValue)) {
        return "[Circular]";
      }

      seen.add(nestedValue);
    }

    return nestedValue;
  });
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

export class ConsoleTransport implements Transport {
  constructor(private readonly formatter: Formatter) {}

  capture(log: LogRecord): void {
    const output = this.formatter.format(log);

    if (log.severity >= Severity.Warn) {
      console.error(output);
      return;
    }

    console.log(output);
  }
}

export class MemoryTransport implements Transport {
  readonly logs: LogRecord[] = [];

  capture(log: LogRecord): void {
    this.logs.push(log);
  }
}

export class CompositeTransport implements Transport {
  constructor(private readonly transports: readonly Transport[]) {}

  capture(log: LogRecord): void {
    for (const transport of this.transports) {
      transport.capture(log);
    }
  }
}
