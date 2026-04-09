import { assertMeta, DEFAULT_CLOCK, getSeverityName } from "./shared.js";
import { Transport, Severity, LogMeta, LogRecord, ILogger } from "./core.js";
import { LoggerOptions } from "./types.js";

export class Logger implements ILogger {
  private _transport: Transport;
  private readonly meta: LogMeta;
  private readonly clock: () => Date;
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
    this._transport = transport;
    this.minSeverity = minSeverity;
  }

  get transport(): Transport {
    return this._transport;
  }

  set transport(transport: Transport) {
    this._transport = transport;
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

    this._transport.capture(record);
  }

  private shouldLog(severity: Severity): boolean {
    return severity >= this.minSeverity;
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
