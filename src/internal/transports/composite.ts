import { LogRecord, Transport } from "../../Logger.js";

export class CompositeTransport implements Transport {
  constructor(private readonly transports: readonly Transport[]) {}

  capture(log: LogRecord): void {
    for (const transport of this.transports) {
      transport.capture(log);
    }
  }
}
