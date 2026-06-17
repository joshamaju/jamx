import { describe, expect, it } from "vitest";

import {
  createContextLogger,
  createLogger,
  createNamedLogger,
  MemoryTransport,
  PrettyFormatter,
  Severity,
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

  it("composes metadata through context wrappers and named helper", () => {
    const transport = new MemoryTransport();

    const logger = createNamedLogger({
      meta: { queue: "emails" },
      name: "worker",
      transport,
    });

    const scoped = createContextLogger(logger, { requestId: "req_42" }).child({
      jobId: "job_7",
    });

    scoped.info("retrying");

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].meta).toEqual({
      logger: "worker",
      queue: "emails",
      requestId: "req_42",
      jobId: "job_7",
    });
  });

  it("processes fully merged records before transport capture", () => {
    const transport = new MemoryTransport();
    const timestamp = new Date("2026-03-03T11:12:35.123Z");

    const logger = createLogger({
      clock: () => timestamp,
      meta: { service: "api" },
      transport,
      processor: {
        process(log) {
          expect(log).toEqual({
            message: "created",
            severity: Severity.Info,
            severityName: "info",
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

    const logger = createLogger({
      minSeverity: Severity.Warn,
      transport,
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
