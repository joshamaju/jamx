import { describe, expect, it } from "vitest";

import {
  CompositeProcessor,
  DefaultsProcessor,
  ErrorProcessor,
  RedactProcessor,
  JsonFormatter,
  Severity,
  type LogRecord,
} from "../src/index.js";

function createRecord(meta: Record<string, unknown>): LogRecord {
  return {
    meta,
    message: "test",
    severityName: "info",
    severity: Severity.Info,
    timestamp: new Date("2026-03-03T11:12:35.123Z"),
  };
}

describe("Processors", () => {
  it("runs composite processors in order", () => {
    const processor = new CompositeProcessor([
      {
        process(log) {
          return { ...log, message: `${log.message}:first` };
        },
      },
      {
        process(log) {
          return { ...log, message: `${log.message}:second` };
        },
      },
    ]);

    expect(processor.process(createRecord({})).message).toBe(
      "test:first:second",
    );
  });

  it("adds default metadata without overwriting existing values", () => {
    const processor = new DefaultsProcessor({
      env: "production",
      service: "api",
    });

    expect(processor.process(createRecord({ service: "worker" })).meta).toEqual(
      {
        env: "production",
        service: "worker",
      },
    );
  });

  it("redacts matching metadata values without changing field names", () => {
    const processor = new RedactProcessor(["token", "password"]);

    const processed = processor.process(
      createRecord({
        token: "secret-token",
        user: {
          id: "user_1",
          password: "secret-password",
        },
      }),
    );

    expect(processed.meta).toEqual({
      token: "[redacted]",
      user: {
        id: "user_1",
        password: "[redacted]",
      },
    });
  });

  it("preserves non-redacted metadata values", () => {
    const tags = ["admin"];
    const settings = { theme: "dark" };
    const record = createRecord({ settings, tags });
    const processor = new RedactProcessor(["token"]);

    const processed = processor.process(record);

    expect(processed.meta).toEqual(record.meta);
  });

  it("does not stringify circular metadata while redacting", () => {
    const processor = new RedactProcessor(["token"]);
    const circular: Record<string, unknown> = { token: "secret-token" };
    circular.self = circular;

    const processed = processor.process(createRecord({ circular }));

    expect(processed.meta.circular).toMatchObject({ token: "[redacted]" });

    expect((processed.meta.circular as Record<string, unknown>).self).toBe(
      processed.meta.circular,
    );

    const output = new JsonFormatter().format(processed);
    expect(output).not.toContain("secret-token");
  });

  it("normalizes error values in metadata", () => {
    const cause = new Error("database unavailable");
    const error = new Error("request failed", { cause });
    const processor = new ErrorProcessor();

    const processed = processor.process(createRecord({ error }));

    expect(processed.meta.error).toMatchObject({
      name: "Error",
      message: "request failed",
      cause: {
        name: "Error",
        message: "database unavailable",
      },
    });
  });

  it("leaves non-error metadata values unchanged", () => {
    const tags = ["admin"];
    const settings = { theme: "dark" };
    const processor = new ErrorProcessor();
    const record = createRecord({ settings, tags });

    const processed = processor.process(record);

    expect(processed.meta).toBe(record.meta);
    expect(processed.meta.settings).toBe(settings);
    expect(processed.meta.tags).toBe(tags);
  });

  it("does not stringify circular metadata while normalizing errors", () => {
    const processor = new ErrorProcessor();

    const circular: Record<string, unknown> = {
      error: new Error("request failed"),
    };

    circular.self = circular;

    const processed = processor.process(createRecord({ circular }));

    expect(
      (processed.meta.circular as Record<string, unknown>).error,
    ).toMatchObject({
      name: "Error",
      message: "request failed",
    });

    expect((processed.meta.circular as Record<string, unknown>).self).toBe(
      circular,
    );
  });
});
