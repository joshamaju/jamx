import type { LogMeta, LogRecord, Processor } from "../core.js";

export class DefaultsProcessor implements Processor {
  constructor(private readonly defaults: LogMeta) {}

  process(log: LogRecord): LogRecord {
    return {
      ...log,
      meta: {
        ...this.defaults,
        ...log.meta,
      },
    };
  }
}
