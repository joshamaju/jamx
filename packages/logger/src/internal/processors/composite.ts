import type { LogRecord, Processor } from "../core.js";

export class CompositeProcessor implements Processor {
  constructor(private readonly processors: readonly Processor[]) {}

  process(log: LogRecord): LogRecord {
    return this.processors.reduce(
      (currentLog, processor) => processor.process(currentLog),
      log,
    );
  }
}
