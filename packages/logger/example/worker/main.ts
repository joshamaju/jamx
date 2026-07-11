import { createNamedLogger, Severity } from "../../src/index.js";
import { WorkerTransport } from "./worker-transport.js";

const transport = new WorkerTransport(
  new URL("./log-worker.mjs", import.meta.url),
  {
    maxPending: 10_000,
  },
);

const logger = createNamedLogger({
  minSeverity: Severity.Debug,
  name: "worker-example",
  transport,
});

logger.info("Job started", { jobId: "job_42" });
logger.info("Job completed", { jobId: "job_42", durationMs: 87 });

await transport.flush();
await transport.close();

if (transport.dropped_records > 0) {
  process.stderr.write(`Dropped logs: ${transport.dropped_records}\n`);
}
