import {
  type Formatter,
  type ILogger,
  type LogMeta,
  type LogRecord,
  type Transport,
  Severity,
} from "../../Logger.js";
import { assertMeta } from "../shared.js";

type TaskStatus = "start" | "update" | "success" | "error";

interface TaskStateMeta {
  id: string;
  status: TaskStatus;
}

interface TaskHandleOptions {
  id?: string;
  meta?: LogMeta;
  severity?: Severity;
}

export interface TaskConsoleTransportOptions {
  formatter: Formatter;
  colorize?: boolean;
  interactive?: boolean;
  write?: (chunk: string) => void;
}

export interface TaskLoggerOptions {
  idFactory?: () => string;
}

function isTaskStateMeta(value: unknown): value is TaskStateMeta {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.status === "string" &&
    ["start", "update", "success", "error"].includes(candidate.status)
  );
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function getProcessLike(): {
  stdout?: { write?: (chunk: string) => void; isTTY?: boolean };
  stderr?: { write?: (chunk: string) => void };
} {
  return (
    (
      globalThis as {
        process?: {
          stdout?: { write?: (chunk: string) => void; isTTY?: boolean };
          stderr?: { write?: (chunk: string) => void };
        };
      }
    ).process ?? {}
  );
}

function getDefaultWrite(): (chunk: string) => void {
  const processLike = getProcessLike();

  return (chunk: string) => {
    processLike.stdout?.write?.(chunk);
  };
}

function getTaskState(log: LogRecord): TaskStateMeta | null {
  const task = log.meta.task;
  return isTaskStateMeta(task) ? task : null;
}

function getDisplayLog(log: LogRecord): LogRecord {
  const { task: _task, ...meta } = log.meta;
  return {
    ...log,
    meta,
  };
}

export class TaskConsoleTransport implements Transport {
  private activeLineWidth = 0;
  private readonly colorize: boolean;
  private readonly formatter: Formatter;
  private readonly interactive: boolean;
  private activeTaskId: string | null = null;
  private readonly write: (chunk: string) => void;

  constructor({
    formatter,
    write = getDefaultWrite(),
    interactive = getProcessLike().stdout?.isTTY ?? false,
    colorize = true,
  }: TaskConsoleTransportOptions) {
    this.formatter = formatter;
    this.write = write;
    this.interactive = interactive;
    this.colorize = colorize;
  }

  capture(log: LogRecord): void {
    const task = getTaskState(log);
    const displayLog = getDisplayLog(log);

    if (!task) {
      this.flushActiveLine();
      this.writeLine(
        this.formatter.format(displayLog),
        log.severity >= Severity.Warn,
      );
      return;
    }

    if (
      !this.interactive ||
      this.activeTaskId === null ||
      this.activeTaskId !== task.id
    ) {
      this.flushActiveLine();
      this.activeTaskId = task.id;
      this.renderActiveLine(this.formatter.format(displayLog));
    } else {
      this.renderActiveLine(this.formatter.format(displayLog));
    }

    if (task.status === "success" || task.status === "error") {
      this.completeActiveLine(log.severity >= Severity.Warn);
    }
  }

  private renderActiveLine(output: string): void {
    if (!this.interactive) {
      this.writeLine(output, false);
      return;
    }

    const visibleWidth = stripAnsi(output).length;
    const paddingWidth = Math.max(this.activeLineWidth - visibleWidth, 0);
    const padding = paddingWidth > 0 ? " ".repeat(paddingWidth) : "";
    this.write(`\r${output}${padding}`);
    this.activeLineWidth = visibleWidth;
  }

  private completeActiveLine(isError: boolean): void {
    if (!this.interactive) {
      this.activeTaskId = null;
      this.activeLineWidth = 0;
      return;
    }

    const suffix = this.colorize
      ? isError
        ? " \u001b[31m[x]\u001b[0m"
        : " \u001b[32m[ok]\u001b[0m"
      : isError
        ? " [x]"
        : " [ok]";

    this.write(`${suffix}\n`);
    this.activeTaskId = null;
    this.activeLineWidth = 0;
  }

  private flushActiveLine(): void {
    if (!this.interactive || this.activeTaskId === null) {
      return;
    }

    this.write("\n");
    this.activeTaskId = null;
    this.activeLineWidth = 0;
  }

  private writeLine(output: string, isError: boolean): void {
    const line = `${output}\n`;
    const processLike = getProcessLike();

    if (isError && processLike.stderr?.write) {
      processLike.stderr.write(line);
      return;
    }

    this.write(line);
  }
}

export class TaskLogger {
  private nextId = 0;

  constructor(
    private readonly logger: ILogger,
    private readonly options: TaskLoggerOptions = {},
  ) {}

  start(
    message: string,
    { id, meta = {}, severity = Severity.Info }: TaskHandleOptions = {},
  ): TaskHandle {
    assertMeta(meta, "Task logger metadata");
    const taskId = id ?? this.createId();

    this.logger.log(severity, message, {
      ...meta,
      task: { id: taskId, status: "start" },
    });

    return new TaskHandle(this.logger, taskId, message, meta, severity);
  }

  private createId(): string {
    if (this.options.idFactory) {
      return this.options.idFactory();
    }

    this.nextId += 1;
    return `task_${this.nextId}`;
  }
}

export class TaskHandle {
  constructor(
    private readonly logger: ILogger,
    private readonly id: string,
    private readonly message: string,
    private readonly meta: LogMeta,
    private readonly startSeverity: Severity,
  ) {}

  update(
    message = this.message,
    meta: LogMeta = {},
    severity = this.startSeverity,
  ): void {
    assertMeta(meta, "Task update metadata");
    this.logger.log(severity, message, this.withTaskMeta(meta, "update"));
  }

  success(
    message = this.message,
    meta: LogMeta = {},
    severity = Severity.Info,
  ): void {
    assertMeta(meta, "Task success metadata");
    this.logger.log(severity, message, this.withTaskMeta(meta, "success"));
  }

  error(
    message = this.message,
    meta: LogMeta = {},
    severity = Severity.Error,
  ): void {
    assertMeta(meta, "Task error metadata");
    this.logger.log(severity, message, this.withTaskMeta(meta, "error"));
  }

  async run<T>(
    work: () => Promise<T>,
    {
      successMessage = this.message,
      errorMessage = this.message,
      successMeta = {},
      errorMeta = {},
    }: {
      successMessage?: string;
      errorMessage?: string;
      successMeta?: LogMeta;
      errorMeta?: LogMeta;
    } = {},
  ): Promise<T> {
    assertMeta(successMeta, "Task success metadata");
    assertMeta(errorMeta, "Task error metadata");

    try {
      const result = await work();
      this.success(successMessage, successMeta);
      return result;
    } catch (error) {
      this.error(errorMessage, { ...errorMeta, error });
      throw error;
    }
  }

  private withTaskMeta(meta: LogMeta, status: TaskStatus): LogMeta {
    return { ...this.meta, ...meta, task: { id: this.id, status } };
  }
}

export function createTaskLogger(
  logger: ILogger,
  options: TaskLoggerOptions = {},
): TaskLogger {
  return new TaskLogger(logger, options);
}
