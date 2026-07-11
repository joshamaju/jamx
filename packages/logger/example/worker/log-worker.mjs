import { parentPort, workerData } from "node:worker_threads";

import { JsonFormatter } from "../../build/index.js";

if (!parentPort) {
  throw new Error("log-worker.mjs must run inside a worker thread.");
}

const formatter = new JsonFormatter();
const discard = workerData?.discard === true;

parentPort.on("message", (message) => {
  if (message?.type === "log") {
    const output = formatter.format(message.record);

    if (discard) {
      parentPort.postMessage({ type: "delivered" });
      return;
    }

    write(`${output}\n`, () => {
      parentPort.postMessage({ type: "delivered" });
    });

    return;
  }

  if (message?.type === "flush") {
    write("", () => {
      parentPort.postMessage({ type: "flushed", id: message.id });
    });

    return;
  }

  if (message?.type === "close") {
    write("", () => {
      parentPort.postMessage({ type: "closed", id: message.id });
      parentPort.close();
    });
  }
});

parentPort.postMessage({ type: "ready" });

function write(output, done) {
  if (discard || process.stderr.write(output)) {
    done();
    return;
  }

  process.stderr.once("drain", done);
}
