import { LogMeta, Transport, Severity } from "./core.js";

export interface LoggerOptions {
  meta?: LogMeta;
  clock?: () => Date;
  transport: Transport;
  minSeverity?: Severity;
}

export interface NamedLoggerOptions extends LoggerOptions {
  name: string;
}
