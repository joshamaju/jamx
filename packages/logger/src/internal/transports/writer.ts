import { Formatter, LogRecord, Transport } from "../core.js";

export type LogWriter = (output: string, log: LogRecord) => void;

export class WriterTransport implements Transport {
  constructor(
    private _formatter: Formatter,
    private readonly write: LogWriter,
  ) {}

  get formatter(): Formatter {
    return this._formatter;
  }

  set formatter(formatter: Formatter) {
    this._formatter = formatter;
  }

  capture(log: LogRecord): void {
    this.write(this._formatter.format(log), log);
  }
}
