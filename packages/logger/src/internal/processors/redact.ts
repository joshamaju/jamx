import type { LogMeta, LogRecord, Processor } from "../core.js";
import { isPlainObject } from "../shared.js";

export interface RedactProcessorOptions {
  replacement?: unknown;
}

function redactValue(
  value: unknown,
  keys: ReadonlySet<string>,
  replacement: unknown,
  copies: WeakMap<object, unknown>,
): unknown {
  if (Array.isArray(value)) {
    const existing = copies.get(value);
    if (existing) return existing;

    const copy: unknown[] = [];
    copies.set(value, copy);
    copy.push(
      ...value.map((item) => redactValue(item, keys, replacement, copies)),
    );

    return copy;
  }

  if (isPlainObject(value)) {
    const existing = copies.get(value);
    if (existing) return existing;

    const copy: LogMeta = {};
    copies.set(value, copy);

    for (const [key, nestedValue] of Object.entries(value)) {
      copy[key] = keys.has(key)
        ? replacement
        : redactValue(nestedValue, keys, replacement, copies);
    }

    return copy;
  }

  return value;
}

export class RedactProcessor implements Processor {
  private readonly keys: ReadonlySet<string>;
  private readonly replacement: unknown;

  constructor(keys: readonly string[], options: RedactProcessorOptions = {}) {
    this.replacement = options.replacement ?? "[redacted]";
    this.keys = new Set(keys);
  }

  process(log: LogRecord): LogRecord {
    const meta = redactValue(
      log.meta,
      this.keys,
      this.replacement,
      new WeakMap<object, unknown>(),
    ) as LogMeta;

    return { ...log, meta };
  }
}
