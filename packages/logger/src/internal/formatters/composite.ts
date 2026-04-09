import { Formatter, LogRecord } from "../core.js";

export class CompositeFormatter implements Formatter {
  constructor(private readonly formatters: readonly Formatter[]) {}

  format(entry: LogRecord): string {
    const log = this.formatters.reduce((log, formatter) => {
      return { ...log, message: formatter.format(log) };
    }, entry);
    return log.message;
  }
}
