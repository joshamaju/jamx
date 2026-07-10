import { Formatter, LogRecord, Transport } from "../core.js";
import { CompositeFormatter } from "../formatters/composite.js";

export class CompositeTransport implements Transport {
  constructor(
    private readonly transports: readonly (
      | Transport
      | ((log: LogRecord) => Transport | null)
    )[],
  ) {}

  get formatter() {
    return new CompositeFormatter(
      this.transports
        .map((_) => (typeof _ == "function" ? null : _.formatter))
        .filter((_) => !!_),
    );
  }

  set formatter(formatter: Formatter) {
    this.transports.forEach((transport) => {
      if (typeof transport !== "function") {
        transport.formatter = formatter;
      }
    });
  }

  capture(log: LogRecord): void {
    for (const transport of this.transports) {
      try {
        const resolved =
          typeof transport === "function" ? transport(log) : transport;
        resolved?.capture(log);
      } catch {
        // Fan-out is best-effort; one destination must not block the others.
      }
    }
  }
}
