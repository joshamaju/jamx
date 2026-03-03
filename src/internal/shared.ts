import { LogMeta, Severity } from "../Logger.js";

export const DEFAULT_CLOCK = () => new Date();

export function getSeverityName(severity: Severity): string {
  return Severity[severity]?.toLowerCase() ?? "unknown";
}

export function isPlainObject(value: unknown): value is LogMeta {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
}

export function assertMeta(
  value: unknown,
  label: string,
): asserts value is LogMeta {
  if (!isPlainObject(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_, nestedValue: unknown) => {
    if (nestedValue instanceof Error) {
      return {
        name: nestedValue.name,
        message: nestedValue.message,
        stack: nestedValue.stack,
      };
    }

    if (typeof nestedValue === "bigint") {
      return nestedValue.toString();
    }

    if (nestedValue && typeof nestedValue === "object") {
      if (seen.has(nestedValue)) {
        return "[Circular]";
      }

      seen.add(nestedValue);
    }

    return nestedValue;
  });
}
