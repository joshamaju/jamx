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
    name: error.name,
    message: error.message,
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
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    return normalizeError(value, seen);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    let changed = false;
    const nextValue = value.map((item) => {
      const normalizedItem = normalizeValue(item, seen);
      changed ||= normalizedItem !== item;
      return normalizedItem;
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
        const normalizedValue = normalizeValue(nestedValue, seen);
        changed ||= normalizedValue !== nestedValue;
        return [key, normalizedValue];
      }),
    );

    return changed ? nextValue : value;
  }

  return value;
}

export class ErrorProcessor implements Processor {
  process(log: LogRecord): LogRecord {
    const meta = normalizeValue(log.meta, new WeakSet<object>()) as LogMeta;

    return {
      ...log,
      meta,
    };
  }
}
