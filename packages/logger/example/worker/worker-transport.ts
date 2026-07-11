import { Worker, type WorkerOptions } from "node:worker_threads";

import type { LogRecord, Transport } from "../../src/index.js";

interface WorkerTransportOptions {
  maxPending?: number;
  workerOptions?: WorkerOptions;
}

interface LifecycleResponse {
  type: "flushed" | "closed";
  id: number;
}

interface DeliveredResponse {
  type: "delivered";
}

interface ReadyResponse {
  type: "ready";
}

type WorkerResponse = LifecycleResponse | DeliveredResponse | ReadyResponse;

export class WorkerTransport implements Transport {
  private readonly lifecycle = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  private rejectReady!: (error: Error) => void;
  private readonly queued: LogRecord[] = [];
  private readonly ready: Promise<void>;
  private readonly max_pending: number;
  private resolveReady!: () => void;
  private readonly worker: Worker;
  private is_ready = false;
  private closed = false;
  private failed?: Error;
  private pending = 0;
  dropped_records = 0;
  private next_id = 0;

  constructor(workerUrl: URL, options: WorkerTransportOptions = {}) {
    this.max_pending = options.maxPending ?? 10_000;

    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.worker = new Worker(workerUrl, options.workerOptions);

    this.worker.on("message", (message: WorkerResponse) => {
      this.handleMessage(message);
    });

    this.worker.on("error", (error) => {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    });

    this.worker.on("exit", (code) => {
      if (!this.closed) {
        this.fail(new Error(`Log worker exited with code ${code}.`));
      }
    });
  }

  capture(log: LogRecord): void {
    if (this.closed || this.failed) return;

    if (this.pending >= this.max_pending) {
      this.dropped_records += 1;
      return;
    }

    this.pending += 1;

    if (!this.is_ready) {
      this.queued.push(log);
      return;
    }

    this.worker.postMessage({ type: "log", record: log });
  }

  async flush(): Promise<void> {
    if (this.failed) throw this.failed;
    await this.ready;
    this.drainQueued();
    await this.request("flush");
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    if (this.failed) throw this.failed;

    await this.ready;
    this.drainQueued();
    await this.request("close");
  }

  private drainQueued(): void {
    while (this.queued.length > 0) {
      this.worker.postMessage({ type: "log", record: this.queued.shift() });
    }
  }

  private request(type: "flush" | "close"): Promise<void> {
    const id = this.next_id++;

    return new Promise<void>((resolve, reject) => {
      this.lifecycle.set(id, { resolve, reject });
      this.worker.postMessage({ type, id });
    });
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === "ready") {
      this.is_ready = true;
      this.resolveReady();
      this.drainQueued();
      return;
    }

    if (message.type === "delivered") {
      this.pending = Math.max(0, this.pending - 1);
      return;
    }

    const pending = this.lifecycle.get(message.id);

    if (!pending) return;

    this.lifecycle.delete(message.id);
    pending.resolve();
  }

  private fail(error: Error): void {
    if (this.failed) return;

    this.failed = error;
    this.rejectReady(error);

    for (const pending of this.lifecycle.values()) {
      pending.reject(error);
    }

    this.lifecycle.clear();
  }
}
