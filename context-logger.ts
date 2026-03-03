import { createLogger } from "./logger.js";
import {
  assertMeta,
  type ILogger,
  type LogMeta,
  type NamedLoggerOptions,
  Severity,
} from "./shared.js";

export class ContextLogger implements ILogger {
  constructor(
    private readonly logger: ILogger,
    private readonly meta: LogMeta = {},
  ) {
    assertMeta(meta, "Context logger base metadata");
  }

  log(severity: Severity, message: string, meta: LogMeta = {}): void {
    assertMeta(meta, "Logger metadata");
    this.logger.log(severity, message, { ...this.meta, ...meta });
  }

  silly(message: string, meta?: LogMeta): void {
    this.log(Severity.Silly, message, meta);
  }

  trace(message: string, meta?: LogMeta): void {
    this.log(Severity.Trace, message, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.log(Severity.Debug, message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log(Severity.Info, message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log(Severity.Warn, message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.log(Severity.Error, message, meta);
  }

  fatal(message: string, meta?: LogMeta): void {
    this.log(Severity.Fatal, message, meta);
  }

  child(meta: LogMeta): ContextLogger {
    assertMeta(meta, "Child logger metadata");
    return new ContextLogger(this.logger, { ...this.meta, ...meta });
  }
}

export function createContextLogger(
  logger: ILogger,
  meta: LogMeta = {},
): ContextLogger {
  return new ContextLogger(logger, meta);
}

export function createNamedLogger({
  name,
  meta = {},
  ...options
}: NamedLoggerOptions): ContextLogger {
  return createContextLogger(createLogger(options), { ...meta, logger: name });
}
