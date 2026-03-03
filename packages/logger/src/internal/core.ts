export enum Severity {
  Silly = 0,
  Trace = 1,
  Debug = 2,
  Info = 3,
  Warn = 4,
  Error = 5,
  Fatal = 6,
}

export type LogMeta = Record<string, unknown>;

export interface LogRecord {
  severity: Severity;
  severityName: string;
  timestamp: Date;
  message: string;
  meta: LogMeta;
}

export interface ILogger {
  log(severity: Severity, message: string, meta?: LogMeta): void;
}

export interface Transport {
  capture(log: LogRecord): void;
}

export interface Formatter {
  format(log: LogRecord): string;
}
