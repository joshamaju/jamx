import { once } from "node:events";
import { performance } from "node:perf_hooks";

import pino from "pino";

import {
  createLogger,
  JsonFormatter,
  WriterTransport,
} from "../src/index.js";
import { WorkerTransport } from "../example/worker/worker-transport.js";

interface Result {
  "startup ms": number;
  "enqueue ops/s": number;
  "delivered ops/s": number;
  "flush ms": number;
  dropped: number;
}

interface Flushable {
  ready?: boolean;
  flushSync(): void;
}

const records = 50_000;
let checksum = 0;

function rate(duration: number): number {
  return Math.round(records / (duration / 1_000));
}

function rounded(duration: number): number {
  return Number(duration.toFixed(2));
}

async function waitForPinoReady(
  transport: Flushable & NodeJS.EventEmitter,
): Promise<void> {
  if (transport.ready) return;
  await once(transport, "ready");
}

const jamxSyncLogger = createLogger({
  transport: new WriterTransport(new JsonFormatter(), (output) => {
    checksum += output.length;
  }),
});
const jamxSyncStart = performance.now();
for (let index = 0; index < records; index += 1) {
  jamxSyncLogger.info("benchmark record", { index, requestId: "req_42" });
}
const jamxSyncDuration = performance.now() - jamxSyncStart;

const pinoSyncLogger = pino(
  { base: null, timestamp: pino.stdTimeFunctions.isoTime },
  {
    write(output: string) {
      checksum += output.length;
    },
  },
);
const pinoSyncStart = performance.now();
for (let index = 0; index < records; index += 1) {
  pinoSyncLogger.info(
    { meta: { index, requestId: "req_42" } },
    "benchmark record",
  );
}
const pinoSyncDuration = performance.now() - pinoSyncStart;

const jamxWorkerStartupStart = performance.now();
const jamxWorkerTransport = new WorkerTransport(
  new URL("../example/worker/log-worker.mjs", import.meta.url),
  {
    maxPending: records,
    workerOptions: { workerData: { discard: true } },
  },
);
await jamxWorkerTransport.flush();
const jamxWorkerStartup = performance.now() - jamxWorkerStartupStart;
const jamxWorkerLogger = createLogger({ transport: jamxWorkerTransport });
const jamxWorkerEndToEndStart = performance.now();
const jamxWorkerEnqueueStart = performance.now();
for (let index = 0; index < records; index += 1) {
  jamxWorkerLogger.info("benchmark record", { index, requestId: "req_42" });
}
const jamxWorkerEnqueue = performance.now() - jamxWorkerEnqueueStart;
const jamxWorkerFlushStart = performance.now();
await jamxWorkerTransport.flush();
const jamxWorkerFlush = performance.now() - jamxWorkerFlushStart;
const jamxWorkerEndToEnd = performance.now() - jamxWorkerEndToEndStart;
await jamxWorkerTransport.close();

const pinoWorkerStartupStart = performance.now();
const pinoWorkerTransport = pino.transport({
  target: new URL("./pino-worker-target.mjs", import.meta.url).href,
});
await waitForPinoReady(pinoWorkerTransport);
const pinoWorkerStartup = performance.now() - pinoWorkerStartupStart;
const pinoWorkerLogger = pino(
  { base: null, timestamp: pino.stdTimeFunctions.isoTime },
  pinoWorkerTransport,
);
const pinoWorkerEndToEndStart = performance.now();
const pinoWorkerEnqueueStart = performance.now();
for (let index = 0; index < records; index += 1) {
  pinoWorkerLogger.info(
    { meta: { index, requestId: "req_42" } },
    "benchmark record",
  );
}
const pinoWorkerEnqueue = performance.now() - pinoWorkerEnqueueStart;
const pinoWorkerFlushStart = performance.now();
pinoWorkerTransport.flushSync();
const pinoWorkerFlush = performance.now() - pinoWorkerFlushStart;
const pinoWorkerEndToEnd = performance.now() - pinoWorkerEndToEndStart;
pinoWorkerTransport.end();

const results: Record<string, Result> = {
  "Jamx synchronous": {
    "startup ms": 0,
    "enqueue ops/s": rate(jamxSyncDuration),
    "delivered ops/s": rate(jamxSyncDuration),
    "flush ms": 0,
    dropped: 0,
  },
  "Jamx worker": {
    "startup ms": rounded(jamxWorkerStartup),
    "enqueue ops/s": rate(jamxWorkerEnqueue),
    "delivered ops/s": rate(jamxWorkerEndToEnd),
    "flush ms": rounded(jamxWorkerFlush),
    dropped: jamxWorkerTransport.droppedRecords,
  },
  "Pino synchronous": {
    "startup ms": 0,
    "enqueue ops/s": rate(pinoSyncDuration),
    "delivered ops/s": rate(pinoSyncDuration),
    "flush ms": 0,
    dropped: 0,
  },
  "Pino worker": {
    "startup ms": rounded(pinoWorkerStartup),
    "enqueue ops/s": rate(pinoWorkerEnqueue),
    "delivered ops/s": rate(pinoWorkerEndToEnd),
    "flush ms": rounded(pinoWorkerFlush),
    dropped: 0,
  },
};

console.table(results);
console.log(`checksum: ${checksum}`);
console.log(
  "Note: Pino serializes on the main thread before its worker; the Jamx example formats structured records inside its worker.",
);
