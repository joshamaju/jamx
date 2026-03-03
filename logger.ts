import {
  assertMeta,
  DEFAULT_CLOCK,
  getSeverityName,
  type ILogger,
  type LogMeta,
  type LogRecord,
  type LoggerOptions,
  Severity,
  type Transport,
} from "./shared.js";

export class Logger implements ILogger {
  private readonly meta: LogMeta;
  private readonly clock: () => Date;
  private readonly transport: Transport;
  private readonly minSeverity: Severity;

  constructor({
    transport,
    meta = {},
    clock = DEFAULT_CLOCK,
    minSeverity = Severity.Info,
  }: LoggerOptions) {
    assertMeta(meta, "Logger base metadata");
    this.clock = clock;
    this.meta = { ...meta };
    this.transport = transport;
    this.minSeverity = minSeverity;
  }

  log(severity: Severity, message: string, meta: LogMeta = {}): void {
    if (!this.shouldLog(severity)) {
      return;
    }

    assertMeta(meta, "Logger metadata");

    const record: LogRecord = {
      message,
      severity,
      timestamp: this.clock(),
      meta: { ...this.meta, ...meta },
      severityName: getSeverityName(severity),
    };

    this.transport.capture(record);
  }

  private shouldLog(severity: Severity): boolean {
    return severity >= this.minSeverity;
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
