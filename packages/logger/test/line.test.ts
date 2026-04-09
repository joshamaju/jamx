import { describe, expect, it, vi } from "vitest";

import { Severity, type LogRecord } from "../src/internal/core.js";
import { LineConsoleTransport } from "../src/internal/transports/line.js";

async function flushTransport(): Promise<void> {
  await new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("LineConsoleTransport", () => {
  it("strips internal line metadata from formatter output", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      interactive: false,
      write,
      formatter: {
        format(log: LogRecord) {
          return JSON.stringify(log.meta);
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        lineId: "job-123",
        finalize: true,
        requestId: "req_1",
      },
    });

    await flushTransport();

    expect(write).toHaveBeenCalledWith('{"requestId":"req_1"}\n');
  });

  it("falls back to append-only output when not interactive", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      interactive: false,
      write,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        lineId: "job-123",
      },
    });

    transport.capture({
      severityName: "error",
      severity: Severity.Error,
      message: "failed",
      timestamp: new Date("2026-03-03T11:12:36.123Z"),
      meta: {
        lineId: "job-123",
        finalize: true,
      },
    });

    await flushTransport();

    expect(write.mock.calls).toEqual([["starting\nfailed\n"]]);
  });

  it("replaces active lines, evicts finalized ids, and allows reuse", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      interactive: true,
      write,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        lineId: "job-123",
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "some other log",
      timestamp: new Date("2026-03-03T11:12:35.223Z"),
      meta: {},
    });

    transport.capture({
      severityName: "error",
      severity: Severity.Error,
      message: "my error",
      timestamp: new Date("2026-03-03T11:12:35.323Z"),
      meta: {
        lineId: "job-123",
        finalize: true,
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "retrying",
      timestamp: new Date("2026-03-03T11:12:35.423Z"),
      meta: {
        lineId: "job-123",
      },
    });

    await flushTransport();

    expect(write.mock.calls).toEqual([
      ["starting\n\rsome other log\u001b[1A\r\u001b[2Kmy error\u001b[1B\r\n\rretrying"],
    ]);
  });

  it("skips redundant rewrites when the rendered output has not changed", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      interactive: true,
      write,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        lineId: "job-123",
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.223Z"),
      meta: {
        lineId: "job-123",
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "starting",
      timestamp: new Date("2026-03-03T11:12:35.323Z"),
      meta: {
        lineId: "job-123",
        finalize: true,
      },
    });

    await flushTransport();

    expect(write.mock.calls).toEqual([["starting"]]);
  });
});
