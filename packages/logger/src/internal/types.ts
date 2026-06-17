import { LogMeta, Transport, Severity, Processor } from "./core.js";

export interface LoggerOptions {
  meta?: LogMeta;
  clock?: () => Date;
  transport: Transport;
  processor?: Processor;
  minSeverity?: Severity;
}

export interface NamedLoggerOptions extends LoggerOptions {
  name: string;
}
