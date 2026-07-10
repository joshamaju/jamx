import { assertMeta, DEFAULT_CLOCK, getSeverityName } from "./shared.js";
import {
  Transport,
  Severity,
  LogMeta,
  LogRecord,
  ILogger,
  Processor,
} from "./core.js";
import { LoggerOptions } from "./types.js";

export class CoreLogger implements ILogger {
  private _transport: Transport;
  private _processor?: Processor;
  private readonly meta: LogMeta;
  private readonly clock: () => Date;
  private readonly minSeverity: Severity;

  constructor({
    transport,
    meta = {},
    processor,
    clock = DEFAULT_CLOCK,
    minSeverity = Severity.Info,
  }: LoggerOptions) {
    assertMeta(meta, "Logger base metadata");
    this.clock = clock;
    this.meta = { ...meta };
    this._processor = processor;
    this._transport = transport;
    this.minSeverity = minSeverity;
  }

  get transport(): Transport {
    return this._transport;
  }

  set transport(transport: Transport) {
    this._transport = transport;
  }

  get processor(): Processor | undefined {
    return this._processor;
  }

  set processor(processor: Processor | undefined) {
    this._processor = processor;
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

    let processed_record = record;

    if (this._processor) {
      try {
        processed_record = this._processor.process(record);
      } catch {
        // Logging is best-effort. A processor must not break application code.
      }
    }

    try {
      this._transport.capture(processed_record);
    } catch {
      // Transport and formatter failures must not break application code.
    }
  }

  private shouldLog(severity: Severity): boolean {
    return severity >= this.minSeverity;
  }
}

export function createCoreLogger(options: LoggerOptions): CoreLogger {
  return new CoreLogger(options);
}
