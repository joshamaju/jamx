import { describe, expect, it, vi } from "vitest";

import {
  createChildLogger,
  createCoreLogger,
  createLogger,
  createNamedLogger,
  CompositeTransport,
  ConsoleTransport,
  MemoryTransport,
  PrettyFormatter,
  PrintfFormatter,
  Severity,
  WriterTransport,
} from "../src/index.js";

describe("Logger", () => {
  it("filters by severity and merges base metadata", () => {
    const transport = new MemoryTransport();

    const logger = createLogger({
      minSeverity: Severity.Warn,
      meta: { service: "api" },
      transport,
    });

    logger.log(Severity.Info, "ignored", { requestId: "req_1" });
    logger.log(Severity.Error, "failed", { requestId: "req_2" });

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0]).toMatchObject({
      severity: Severity.Error,
      severityName: "error",
      message: "failed",
      meta: {
        service: "api",
        requestId: "req_2",
      },
    });
  });

  it("composes metadata through child loggers and named helper", () => {
    const transport = new MemoryTransport();

    const logger = createNamedLogger({
      meta: { queue: "emails" },
      name: "worker",
      transport,
    });

    const requestLogger = createChildLogger(logger, { requestId: "req_42" });
    const scoped = createChildLogger(requestLogger, { jobId: "job_7" });

    scoped.info("retrying");

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].meta).toEqual({
      requestId: "req_42",
      logger: "worker",
      queue: "emails",
      jobId: "job_7",
    });
  });

  it("processes fully merged records before transport capture", () => {
    const transport = new MemoryTransport();
    const timestamp = new Date("2026-03-03T11:12:35.123Z");

    const logger = createCoreLogger({
      clock: () => timestamp,
      meta: { service: "api" },
      transport,
      processor: {
        process(log) {
          expect(log).toEqual({
            message: "created",
            severityName: "info",
            severity: Severity.Info,
            timestamp,
            meta: {
              requestId: "req_1",
              service: "api",
            },
          });

          return {
            ...log,
            message: "processed",
            meta: {
              ...log.meta,
              redacted: true,
            },
          };
        },
      },
    });

    logger.log(Severity.Info, "created", { requestId: "req_1" });

    expect(transport.logs).toHaveLength(1);

    expect(transport.logs[0]).toMatchObject({
      message: "processed",
      meta: {
        requestId: "req_1",
        service: "api",
        redacted: true,
      },
    });
  });

  it("does not process records filtered by severity", () => {
    const transport = new MemoryTransport();

    let processed = 0;

    const logger = createCoreLogger({
      transport,
      minSeverity: Severity.Warn,
      processor: {
        process(log) {
          processed += 1;
          return log;
        },
      },
    });

    logger.log(Severity.Info, "ignored");

    expect(processed).toBe(0);
    expect(transport.logs).toHaveLength(0);
  });

  it("falls back to the original record when a processor throws", () => {
    const transport = new MemoryTransport();

    const logger = createCoreLogger({
      transport,
      processor: {
        process() {
          throw new Error("processor failed");
        },
      },
    });

    expect(() => logger.log(Severity.Info, "still captured")).not.toThrow();
    expect(transport.logs[0]?.message).toBe("still captured");
  });

  it("does not propagate transport or formatter failures", () => {
    const transportLogger = createCoreLogger({
      transport: {
        capture() {
          throw new Error("transport failed");
        },
      },
    });

    const formatterLogger = createCoreLogger({
      transport: new ConsoleTransport({
        format() {
          throw new Error("formatter failed");
        },
      }),
    });

    expect(() => transportLogger.log(Severity.Info, "safe")).not.toThrow();
    expect(() => formatterLogger.log(Severity.Info, "safe")).not.toThrow();
  });

  it("continues composite fan-out after a destination fails", () => {
    const memory = new MemoryTransport();

    const transport = new CompositeTransport([
      {
        capture() {
          throw new Error("destination failed");
        },
      },
      memory,
    ]);

    createCoreLogger({ transport }).log(Severity.Info, "delivered");

    expect(memory.logs[0]?.message).toBe("delivered");
  });

  it("flushes and closes every resolved composite destination", async () => {
    const calls: string[] = [];

    const first = {
      capture() {},
      async flush() {
        calls.push("first:flush");
      },
      async close() {
        calls.push("first:close");
      },
    };

    const second = {
      capture() {},
      async flush() {
        calls.push("second:flush");
        throw new Error("flush failed");
      },
    };

    const transport = new CompositeTransport([first, () => second]);

    const logger = createCoreLogger({ transport });

    logger.log(Severity.Info, "queued");

    await transport.flush();
    await transport.close();
    await transport.close();

    logger.log(Severity.Info, "ignored");

    expect(calls).toEqual([
      "first:flush",
      "second:flush",
      "first:close",
      "second:flush",
    ]);
  });
});

describe("WriterTransport", () => {
  it("writes formatted output with the original record", () => {
    const writes: Array<{ output: string; message: string }> = [];
    const transport = new WriterTransport(
      { format: (log) => log.message.toUpperCase() },
      (output, log) => writes.push({ output, message: log.message }),
    );
    const logger = createCoreLogger({ transport });

    logger.log(Severity.Info, "written");

    expect(writes).toEqual([{ output: "WRITTEN", message: "written" }]);
  });

  it("supports replacing its formatter", () => {
    const writes: string[] = [];
    const transport = new WriterTransport(
      { format: (log) => log.message },
      (output) => writes.push(output),
    );

    transport.formatter = { format: (log) => `[${log.message}]` };
    createCoreLogger({ transport }).log(Severity.Info, "updated");

    expect(writes).toEqual(["[updated]"]);
  });
});

describe("ConsoleTransport", () => {
  it("preserves severity-based console routing", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createCoreLogger({
      minSeverity: Severity.Debug,
      transport: new ConsoleTransport({ format: (record) => record.message }),
    });

    logger.log(Severity.Info, "info");
    logger.log(Severity.Warn, "warn");

    expect(log).toHaveBeenCalledWith("info");
    expect(error).toHaveBeenCalledWith("warn");

    log.mockRestore();
    error.mockRestore();
  });
});

describe("PrettyFormatter", () => {
  it("keeps metadata uniform and can disable ANSI colors", () => {
    const formatter = new PrettyFormatter({ colorize: false });

    const output = formatter.format({
      message: "Timeout",
      severityName: "info",
      severity: Severity.Info,
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        logger: "api-gateway",
        requestId: "req_91f5",
        endpoint: "/users/42",
        note: "took too long",
      },
    });

    expect(output).toBe(
      '2026-03-03T11:12:35.123Z INFO  Timeout | logger=api-gateway requestId=req_91f5 endpoint=/users/42 note="took too long"',
    );

    expect(output).not.toMatch(/\u001b\[/);
  });
});

describe("PrintfFormatter", () => {
  it("does not mutate the shared log record", () => {
    const formatter = new PrintfFormatter();

    const record = {
      message: "hello %s",
      severityName: "info",
      severity: Severity.Info,
      meta: { name: "world" },
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
    };

    formatter.format(record);
    expect(record.message).toBe("hello %s");
  });
});
