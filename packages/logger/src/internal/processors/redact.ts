import type { LogMeta, LogRecord, Processor } from "../core.js";
import { isPlainObject } from "../shared.js";

export interface RedactProcessorOptions {
  replacement?: unknown;
}

function redactValue(
  value: unknown,
  keys: ReadonlySet<string>,
  replacement: unknown,
  seen: WeakSet<object>,
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    let changed = false;
    const nextValue = value.map((item) => {
      const redactedItem = redactValue(item, keys, replacement, seen);
      changed ||= redactedItem !== item;
      return redactedItem;
    });

    return changed ? nextValue : value;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    let changed = false;
    const nextValue = Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        if (keys.has(key)) {
          changed ||= replacement !== nestedValue;
          return [key, replacement];
        }

        const redactedValue = redactValue(nestedValue, keys, replacement, seen);
        changed ||= redactedValue !== nestedValue;

        return [key, redactedValue];
      }),
    );

    return changed ? nextValue : value;
  }

  return value;
}

export class RedactProcessor implements Processor {
  private readonly keys: ReadonlySet<string>;
  private readonly replacement: unknown;

  constructor(keys: readonly string[], options: RedactProcessorOptions = {}) {
    this.keys = new Set(keys);
    this.replacement = options.replacement ?? "[redacted]";
  }

  process(log: LogRecord): LogRecord {
    const meta = redactValue(
      log.meta,
      this.keys,
      this.replacement,
      new WeakSet<object>(),
    ) as LogMeta;

    return {
      ...log,
      meta,
    };
  }
}
