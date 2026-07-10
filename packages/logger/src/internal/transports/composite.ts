import { Formatter, LogRecord, Transport } from "../core.js";
import { CompositeFormatter } from "../formatters/composite.js";

export class CompositeTransport implements Transport {
  private readonly resolved_transports = new Set<Transport>();
  private closed = false;

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
    if (this.closed) return;

    for (const transport of this.transports) {
      try {
        const resolved =
          typeof transport === "function" ? transport(log) : transport;

        if (resolved) {
          this.resolved_transports.add(resolved);
        }

        resolved?.capture(log);
      } catch {
        // Fan-out is best-effort; one destination must not block the others.
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.allSettled(
      this.resolveTransports().map((transport) => transport.flush?.()),
    );
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    await Promise.allSettled(
      this.resolveTransports().map(async (transport) => {
        if (transport.close) {
          await transport.close();
          return;
        }

        await transport.flush?.();
      }),
    );
  }

  private resolveTransports(): Transport[] {
    for (const transport of this.transports) {
      if (typeof transport !== "function") {
        this.resolved_transports.add(transport);
      }
    }

    return [...this.resolved_transports];
  }
}
