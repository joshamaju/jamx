import {
  type Formatter,
  type ILogger,
  type LogMeta,
  type LogRecord,
  type Transport,
  Severity,
} from "../core.js";
import { assertMeta } from "../shared.js";

export type TaskStatus = "start" | "update" | "success" | "error";

export interface TaskStateMeta {
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
  frames?: readonly string[];
  prefix?: string;
  successSuffix?: string;
  errorSuffix?: string;
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

const DEFAULT_FRAMES = ["-", "\\", "|", "/"] as const;
const COLOR_RESET = "\u001b[0m";
const COLOR_GREEN = "\u001b[32m";
const COLOR_RED = "\u001b[31m";
const COLOR_DIM = "\u001b[2m";

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

interface ActiveTaskState {
  frameIndex: number;
  output: string;
}

export class TaskConsoleTransport implements Transport {
  private readonly activeTasks = new Map<string, ActiveTaskState>();
  private readonly colorize: boolean;
  private readonly errorSuffix: string;
  private readonly formatter: Formatter;
  private readonly frames: readonly string[];
  private readonly interactive: boolean;
  private readonly prefix: string;
  private renderedTaskCount = 0;
  private readonly successSuffix: string;
  private readonly write: (chunk: string) => void;

  constructor({
    formatter,
    write = getDefaultWrite(),
    interactive = getProcessLike().stdout?.isTTY ?? false,
    colorize = true,
    frames = DEFAULT_FRAMES,
    prefix = "",
    successSuffix = "[ok]",
    errorSuffix = "[x]",
  }: TaskConsoleTransportOptions) {
    this.formatter = formatter;
    this.write = write;
    this.interactive = interactive;
    this.colorize = colorize;
    this.frames = frames.length > 0 ? frames : DEFAULT_FRAMES;
    this.prefix = prefix.trim();
    this.successSuffix = successSuffix;
    this.errorSuffix = errorSuffix;
  }

  capture(log: LogRecord): void {
    const task = getTaskState(log);
    const displayLog = getDisplayLog(log);

    if (!task) {
      this.clearRenderedTasks();
      this.writeLine(
        this.formatter.format(displayLog),
        log.severity >= Severity.Warn,
      );
      this.renderActiveTasks();
      return;
    }

    if (!this.interactive) {
      this.writeLine(
        this.formatter.format(displayLog),
        log.severity >= Severity.Warn,
      );
      return;
    }

    const currentTask = this.activeTasks.get(task.id);
    const frameIndex = currentTask?.frameIndex ?? 0;

    if (task.status === "success" || task.status === "error") {
      this.completeTask(
        task.id,
        this.decorateCompletedOutput(
          this.formatter.format(displayLog),
          log.severity >= Severity.Warn,
        ),
        log.severity >= Severity.Warn,
      );
      return;
    }

    this.activeTasks.set(task.id, {
      output: this.decorateActiveOutput(
        this.formatter.format(displayLog),
        frameIndex,
      ),
      frameIndex: (frameIndex + 1) % this.frames.length,
    });

    this.renderActiveTasks();
  }

  private completeTask(taskId: string, output: string, isError: boolean): void {
    this.activeTasks.delete(taskId);

    this.clearRenderedTasks();
    this.writeLine(output, false);
    this.renderActiveTasks();
  }

  private clearRenderedTasks(): void {
    if (!this.interactive || this.renderedTaskCount === 0) {
      return;
    }

    this.write(`\u001b[${this.renderedTaskCount}A\r\u001b[J`);
    this.renderedTaskCount = 0;
  }

  private renderActiveTasks(): void {
    if (!this.interactive) {
      return;
    }

    const lines = Array.from(this.activeTasks.values()).map(
      (task) => task.output,
    );

    this.clearRenderedTasks();

    if (lines.length === 0) {
      this.renderedTaskCount = 0;
      return;
    }

    this.write(lines.join("\n"));
    this.renderedTaskCount = lines.length;
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

  private decorateActiveOutput(output: string, frameIndex: number): string {
    const frame = this.frames[frameIndex] ?? this.frames[0];
    const prefix = this.colorize ? `${COLOR_DIM}${frame}${COLOR_RESET}` : frame;

    return this.joinLineParts([this.prefix, prefix, output]);
  }

  private decorateCompletedOutput(output: string, isError: boolean): string {
    return this.joinLineParts([
      this.prefix,
      output,
      this.getCompletionSuffix(isError),
    ]);
  }

  private getCompletionSuffix(isError: boolean): string {
    const suffix = isError ? this.errorSuffix : this.successSuffix;

    if (!this.colorize) {
      return suffix;
    }

    return isError
      ? `${COLOR_RED}${suffix}${COLOR_RESET}`
      : `${COLOR_GREEN}${suffix}${COLOR_RESET}`;
  }

  private joinLineParts(parts: string[]): string {
    return parts.filter(Boolean).join(" ");
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
