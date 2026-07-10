import { describe, expect, it, vi } from "vitest";

import { Severity, type LogRecord } from "../src/internal/core.js";
import { LineConsoleTransport } from "../src/internal/transports/line.js";

async function flushTransport(): Promise<void> {
  await new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("LineConsoleTransport", () => {
  it("flushes pending writes immediately and remains usable", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      write,
      interactive: false,
      formatter: { format: (log) => log.message },
    });

    transport.capture({
      meta: {},
      message: "first",
      severityName: "info",
      severity: Severity.Info,
      timestamp: new Date(),
    });

    await transport.flush();

    expect(write.mock.calls).toEqual([["first\n"]]);

    transport.capture({
      meta: {},
      message: "second",
      severityName: "info",
      severity: Severity.Info,
      timestamp: new Date(),
    });

    await transport.flush();

    expect(write.mock.calls).toEqual([["first\n"], ["second\n"]]);
  });

  it("flushes on close and ignores subsequent records", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      write,
      interactive: false,
      formatter: { format: (log) => log.message },
    });

    const record: LogRecord = {
      message: "before close",
      severity: Severity.Info,
      timestamp: new Date(),
      severityName: "info",
      meta: {},
    };

    transport.capture(record);

    await transport.close();
    await transport.close();

    transport.capture({ ...record, message: "after close" });

    await transport.flush();

    expect(write.mock.calls).toEqual([["before close\n"]]);
  });

  it("strips internal line metadata from formatter output", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      write,
      interactive: false,
      formatter: {
        format(log: LogRecord) {
          return JSON.stringify(log.meta);
        },
      },
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        finalize: true,
        lineId: "job-123",
        requestId: "req_1",
      },
    });

    await flushTransport();

    expect(write).toHaveBeenCalledWith('{"requestId":"req_1"}\n');
  });

  it("falls back to append-only output when not interactive", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      write,
      interactive: false,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
      meta: { lineId: "job-123" },
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
    });

    transport.capture({
      message: "failed",
      severityName: "error",
      severity: Severity.Error,
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
      write,
      interactive: true,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
      meta: { lineId: "job-123" },
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
    });

    transport.capture({
      meta: {},
      severityName: "info",
      severity: Severity.Info,
      message: "some other log",
      timestamp: new Date("2026-03-03T11:12:35.223Z"),
    });

    transport.capture({
      message: "my error",
      severityName: "error",
      severity: Severity.Error,
      timestamp: new Date("2026-03-03T11:12:35.323Z"),
      meta: {
        lineId: "job-123",
        finalize: true,
      },
    });

    transport.capture({
      message: "retrying",
      severityName: "info",
      severity: Severity.Info,
      meta: { lineId: "job-123" },
      timestamp: new Date("2026-03-03T11:12:35.423Z"),
    });

    await flushTransport();

    expect(write.mock.calls).toEqual([
      [
        "starting\n\rsome other log\u001b[1A\r\u001b[2Kmy error\u001b[1B\r\n\rretrying",
      ],
    ]);
  });

  it("skips redundant rewrites when the rendered output has not changed", async () => {
    const write = vi.fn();

    const transport = new LineConsoleTransport({
      write,
      interactive: true,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
      meta: { lineId: "job-123" },
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
      meta: { lineId: "job-123" },
      timestamp: new Date("2026-03-03T11:12:35.223Z"),
    });

    transport.capture({
      message: "starting",
      severityName: "info",
      severity: Severity.Info,
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
