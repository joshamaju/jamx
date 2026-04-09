import { Formatter, LogRecord, Transport } from "../core.js";
import { CompositeFormatter } from "../formatters/composite.js";

export class CompositeTransport implements Transport {
  constructor(private readonly transports: readonly Transport[]) {}

  get formatter() {
    return new CompositeFormatter(
      this.transports.map((_) => _.formatter).filter((_) => !!_),
    );
  }

  set formatter(formatter: Formatter) {
    this.transports.forEach((transport) => {
      transport.formatter = formatter;
    });
  }

  capture(log: LogRecord): void {
    for (const transport of this.transports) {
      transport.capture(log);
    }
  }
}
