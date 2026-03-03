import { LogRecord, Transport } from "../core.js";

export class MemoryTransport implements Transport {
  readonly logs: LogRecord[] = [];

  capture(log: LogRecord): void {
    this.logs.push(log);
  }
}
