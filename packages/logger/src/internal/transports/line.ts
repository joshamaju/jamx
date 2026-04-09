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
  const nextMeta = { ...meta };

  delete nextMeta[LINE_ID_META_KEY];
  delete nextMeta[FINALIZE_META_KEY];

  return nextMeta;
}

function normalizeLog(log: LogRecord): LogRecord {
  return { ...log, meta: stripLineMeta(log.meta) };
}

export class LineConsoleTransport implements Transport {
  private readonly activeLines = new Map<string, ActiveLine>();
  private readonly renderedLines: string[] = [];
  private readonly interactive: boolean;
  private readonly write: (output: string) => void;
  private readonly pendingWrites: string[] = [];
  private flushScheduled = false;
  private _formatter: Formatter;

  constructor({
    formatter,
    interactive = Boolean(process.stdout?.isTTY),
    write = (output: string) => {
      process.stdout.write(output);
    },
  }: Options) {
    this._formatter = formatter;
    this.interactive = interactive;
    this.write = write;
  }

  get formatter(): Formatter {
    return this._formatter;
  }

  set formatter(formatter: Formatter) {
    this._formatter = formatter;
  }

  capture(log: LogRecord): void {
    const normalizedLog = normalizeLog(log);
    const output = this._formatter.format(normalizedLog);

    if (!this.interactive) {
      this.enqueueWrite(`${output}\n`);
      return;
    }

    const lineId = log.meta[LINE_ID_META_KEY];
    const finalize = isFinalized(log.meta[FINALIZE_META_KEY]);

    if (!isLineId(lineId)) {
      this.appendRenderedLine(output);
      this.renderedLines.push(output);
      return;
    }

    const activeLine = this.activeLines.get(lineId);

    if (activeLine) {
      if (this.renderedLines[activeLine.index] !== output) {
        this.replaceRenderedLine(activeLine.index, output);
        this.renderedLines[activeLine.index] = output;
      }

      if (finalize) {
        this.activeLines.delete(lineId);
      }

      return;
    }

    this.appendRenderedLine(output);
    this.renderedLines.push(output);

    if (!finalize) {
      this.activeLines.set(lineId, { index: this.renderedLines.length - 1 });
    }
  }

  private appendRenderedLine(output: string): void {
    if (this.renderedLines.length === 0) {
      this.enqueueWrite(output);
      return;
    }

    this.enqueueWrite(`\n\r${output}`);
  }

  private replaceRenderedLine(index: number, output: string): void {
    const linesBelow = this.renderedLines.length - index - 1;
    let sequence = "";

    if (linesBelow > 0) {
      sequence += `\u001b[${linesBelow}A`;
    }

    sequence += `\r\u001b[2K${output}`;

    if (linesBelow > 0) {
      sequence += `\u001b[${linesBelow}B`;
    }

    sequence += "\r";

    this.enqueueWrite(sequence);
  }

  private enqueueWrite(output: string): void {
    if (output.length === 0) {
      return;
    }

    this.pendingWrites.push(output);

    if (this.flushScheduled) {
      return;
    }

    this.flushScheduled = true;

    queueMicrotask(() => {
      this.flushScheduled = false;

      if (this.pendingWrites.length === 0) {
        return;
      }

      const flushedOutput = this.pendingWrites.join("");
      this.pendingWrites.length = 0;
      this.write(flushedOutput);
    });
  }
}
