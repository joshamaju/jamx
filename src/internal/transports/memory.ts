import { LogRecord, Transport } from "../../Logger.js";

export class MemoryTransport implements Transport {
  readonly logs: LogRecord[] = [];

  capture(log: LogRecord): void {
    this.logs.push(log);
  }
}
