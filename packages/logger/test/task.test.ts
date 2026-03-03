/// <reference types="@types/node" />

import { afterEach, describe, expect, it, vi } from "vitest";

import { Severity, type LogRecord } from "../src/internal/core.js";
import {
  TaskConsoleTransport,
  createTaskLogger,
} from "../src/internal/transports/task.js";

describe("TaskConsoleTransport", () => {
  const originalProcess = globalThis.process;

  afterEach(() => {
    globalThis.process = originalProcess;
  });

  it("strips internal task metadata from formatter output", () => {
    const write = vi.fn();

    const transport = new TaskConsoleTransport({
      write,
      colorize: false,
      interactive: false,
      formatter: {
        format(log: LogRecord) {
          return JSON.stringify(log.meta);
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "Syncing user",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        userId: "user_42",
        task: {
          id: "task_1",
          status: "start",
        },
      },
    });

    expect(write).toHaveBeenCalledWith('{"userId":"user_42"}\n');
  });

  it("writes non-interactive task errors to stderr", () => {
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();

    globalThis.process = {
      stdout: {
        isTTY: false,
        write: stdoutWrite,
      },
      stderr: {
        write: stderrWrite,
      },
    } as any as typeof globalThis.process;

    const transport = new TaskConsoleTransport({
      colorize: false,
      interactive: false,
      write: stdoutWrite,
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      severityName: "error",
      message: "Task failed",
      severity: Severity.Error,
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        task: {
          id: "task_1",
          status: "error",
        },
      },
    });

    expect(stderrWrite).toHaveBeenCalledWith("Task failed\n");
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("renders interactive task updates as concurrent task rows", () => {
    const write = vi.fn();

    const transport = new TaskConsoleTransport({
      write,
      prefix: "task",
      colorize: false,
      interactive: true,
      frames: [".", "o"],
      successSuffix: "[done]",
      formatter: {
        format(log: LogRecord) {
          return log.message;
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "Syncing user",
      timestamp: new Date("2026-03-03T11:12:35.123Z"),
      meta: {
        task: {
          id: "task_1",
          status: "start",
        },
      },
    });

    transport.capture({
      severityName: "info",
      message: "Fetching org",
      severity: Severity.Info,
      timestamp: new Date("2026-03-03T11:12:36.123Z"),
      meta: {
        task: {
          id: "task_2",
          status: "start",
        },
      },
    });

    transport.capture({
      severityName: "info",
      severity: Severity.Info,
      message: "Still syncing",
      timestamp: new Date("2026-03-03T11:12:36.500Z"),
      meta: {
        task: {
          id: "task_1",
          status: "update",
        },
      },
    });

    transport.capture({
      severityName: "info",
      message: "Fetched org",
      severity: Severity.Info,
      timestamp: new Date("2026-03-03T11:12:37.123Z"),
      meta: {
        task: {
          id: "task_2",
          status: "success",
        },
      },
    });

    expect(write.mock.calls).toEqual([
      ["task . Syncing user"],
      ["\u001b[1A\r\u001b[J"],
      ["task . Syncing user\ntask . Fetching org"],
      ["\u001b[2A\r\u001b[J"],
      ["task o Still syncing\ntask . Fetching org"],
      ["\u001b[2A\r\u001b[J"],
      ["task Fetched org [done]\n"],
      ["task o Still syncing"],
    ]);
  });
});

describe("TaskLogger", () => {
  it("emits structured lifecycle metadata", () => {
    const records: Array<{
      message: string;
      severity: Severity;
      meta?: Record<string, unknown>;
    }> = [];

    const taskLogger = createTaskLogger({
      log(severity, message, meta) {
        records.push({ severity, message, meta });
      },
    });

    const task = taskLogger.start("Syncing user", {
      id: "task_99",
      meta: {
        userId: "user_42",
      },
    });

    task.update("Halfway there", { progress: "50%" });
    task.success("Done", { durationMs: 120 });

    expect(records).toEqual([
      {
        severity: Severity.Info,
        message: "Syncing user",
        meta: {
          userId: "user_42",
          task: {
            id: "task_99",
            status: "start",
          },
        },
      },
      {
        severity: Severity.Info,
        message: "Halfway there",
        meta: {
          progress: "50%",
          userId: "user_42",
          task: {
            id: "task_99",
            status: "update",
          },
        },
      },
      {
        message: "Done",
        severity: Severity.Info,
        meta: {
          durationMs: 120,
          userId: "user_42",
          task: {
            id: "task_99",
            status: "success",
          },
        },
      },
    ]);
  });
});
