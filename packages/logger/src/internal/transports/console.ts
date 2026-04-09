import { Formatter, LogRecord, Severity, Transport } from "../core.js";

export class ConsoleTransport implements Transport {
  constructor(private _formatter: Formatter) {}

  get formatter(): Formatter {
    return this._formatter;
  }

  set formatter(formatter: Formatter) {
    this._formatter = formatter;
  }

  capture(log: LogRecord): void {
    const output = this._formatter.format(log);

    if (log.severity >= Severity.Warn) {
      console.error(output);
      return;
    }

    console.log(output);
  }
}
