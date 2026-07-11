import { Formatter, LogMeta, LogRecord, Transport } from "../core.js";

const LINE_ID_META_KEY = "lineId";
const FINALIZE_META_KEY = "finalize";

export interface Options {
  formatter: Formatter;
  interactive?: boolean;
  write?: (output: string) => void;
}

interface ActiveLine {
  index: number;
}

function isLineId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFinalized(value: unknown): boolean {
  return value === true;
}

function stripLineMeta(meta: LogMeta): LogMeta {
  const next_meta = { ...meta };

  delete next_meta[LINE_ID_META_KEY];
  delete next_meta[FINALIZE_META_KEY];

  return next_meta;
}

function normalizeLog(log: LogRecord): LogRecord {
  return { ...log, meta: stripLineMeta(log.meta) };
}

export class LineConsoleTransport implements Transport {
  private readonly active_lines = new Map<string, ActiveLine>();
  private readonly write: (output: string) => void;
  private readonly rendered_lines: string[] = [];
  private readonly pending_writes: string[] = [];
  private readonly interactive: boolean;
  private flush_scheduled = false;
  private _formatter: Formatter;
  private closed = false;

  constructor({
    formatter,
    interactive = Boolean(process.stdout?.isTTY),
    write = (output: string) => {
      process.stdout.write(output);
    },
  }: Options) {
    this.interactive = interactive;
    this._formatter = formatter;
    this.write = write;
  }

  get formatter(): Formatter {
    return this._formatter;
  }

  set formatter(formatter: Formatter) {
    this._formatter = formatter;
  }

  capture(log: LogRecord): void {
    if (this.closed) return;

    const normalized_log = normalizeLog(log);
    const output = this._formatter.format(normalized_log);

    if (!this.interactive) {
      this.enqueueWrite(`${output}\n`);
      return;
    }

    const line_id = log.meta[LINE_ID_META_KEY];
    const finalize = isFinalized(log.meta[FINALIZE_META_KEY]);

    if (!isLineId(line_id)) {
      this.appendRenderedLine(output);
      this.rendered_lines.push(output);
      return;
    }

    const active_line = this.active_lines.get(line_id);

    if (active_line) {
      if (this.rendered_lines[active_line.index] !== output) {
        this.replaceRenderedLine(active_line.index, output);
        this.rendered_lines[active_line.index] = output;
      }

      if (finalize) {
        this.active_lines.delete(line_id);
      }

      return;
    }

    this.appendRenderedLine(output);
    this.rendered_lines.push(output);

    if (!finalize) {
      this.active_lines.set(line_id, { index: this.rendered_lines.length - 1 });
    }
  }

  async flush(): Promise<void> {
    this.flushPendingWrites();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.flush();
  }

  private appendRenderedLine(output: string): void {
    if (this.rendered_lines.length === 0) {
      this.enqueueWrite(output);
      return;
    }

    this.enqueueWrite(`\n\r${output}`);
  }

  private replaceRenderedLine(index: number, output: string): void {
    const lines_below = this.rendered_lines.length - index - 1;
    let sequence = "";

    if (lines_below > 0) {
      sequence += `\u001b[${lines_below}A`;
    }

    sequence += `\r\u001b[2K${output}`;

    if (lines_below > 0) {
      sequence += `\u001b[${lines_below}B`;
    }

    sequence += "\r";

    this.enqueueWrite(sequence);
  }

  private enqueueWrite(output: string): void {
    if (output.length === 0) return;

    this.pending_writes.push(output);

    if (this.flush_scheduled) return;

    this.flush_scheduled = true;

    queueMicrotask(() => {
      this.flush_scheduled = false;
      this.flushPendingWrites();
    });
  }

  private flushPendingWrites(): void {
    if (this.pending_writes.length === 0) {
      return;
    }

    const output = this.pending_writes.join("");
    this.pending_writes.length = 0;
    this.write(output);
  }
}
