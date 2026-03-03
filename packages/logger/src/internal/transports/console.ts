import { Formatter, LogRecord, Severity, Transport } from "../core.js";

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
