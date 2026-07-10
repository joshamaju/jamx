import type { LogMeta, LogRecord, Processor } from "../core.js";
import { isPlainObject } from "../shared.js";

interface NormalizedError {
  name: string;
  stack?: string;
  message: string;
  cause?: unknown;
}

function normalizeError(error: Error, seen: WeakSet<object>): NormalizedError {
  const normalized: NormalizedError = {
    message: error.message,
    name: error.name,
  };

  if (error.stack) {
    normalized.stack = error.stack;
  }

  const cause = (error as { cause?: unknown }).cause;

  if (cause !== undefined) {
    normalized.cause = normalizeValue(cause, seen);
  }

  return normalized;
}

function normalizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Error) {
    if (seen.has(value)) return value;

    seen.add(value);

    return normalizeError(value, seen);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return value;

    seen.add(value);

    let changed = false;

    const next_value = value.map((item) => {
      const normalized_item = normalizeValue(item, seen);
      changed ||= normalized_item !== item;
      return normalized_item;
    });

    return changed ? next_value : value;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return value;

    seen.add(value);

    let changed = false;

    const next_value = Object.fromEntries(
      Object.entries(value).map(([key, nested_value]) => {
        const normalized_value = normalizeValue(nested_value, seen);
        changed ||= normalized_value !== nested_value;
        return [key, normalized_value];
      }),
    );

    return changed ? next_value : value;
  }

  return value;
}

export class ErrorProcessor implements Processor {
  process(log: LogRecord): LogRecord {
    const meta = normalizeValue(log.meta, new WeakSet<object>()) as LogMeta;
    return { ...log, meta };
  }
}
