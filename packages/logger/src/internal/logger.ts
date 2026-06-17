import { ILogger, LogMeta, Processor, Severity, Transport } from "./core.js";
import { LoggerOptions, NamedLoggerOptions } from "./types.js";
import { createCoreLogger } from "./core-logger.js";
import { assertMeta } from "./shared.js";

export class Logger implements ILogger {
  constructor(
    private readonly logger: ILogger,
    private readonly meta: LogMeta = {},
  ) {
    assertMeta(meta, "Logger base metadata");
  }

  get transport(): Transport {
    return this.logger.transport;
  }

  set transport(transport: Transport) {
    this.logger.transport = transport;
  }

  get processor(): Processor | undefined {
    return this.logger.processor;
  }

  set processor(processor: Processor | undefined) {
    this.logger.processor = processor;
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
}

export function createLoggerFacade(
  logger: ILogger,
  meta: LogMeta = {},
): Logger {
  return new Logger(logger, meta);
}

export function createChildLogger(logger: ILogger, meta: LogMeta): Logger {
  assertMeta(meta, "Child logger metadata");
  return new Logger(logger, meta);
}

export function createLogger(options: LoggerOptions): Logger {
  return createLoggerFacade(createCoreLogger(options));
}

export function createNamedLogger({
  name,
  meta = {},
  ...options
}: NamedLoggerOptions): Logger {
  return createLoggerFacade(createCoreLogger(options), {
    ...meta,
    logger: name,
  });
}
