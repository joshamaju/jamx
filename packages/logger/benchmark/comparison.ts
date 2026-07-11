import { Writable } from "node:stream";

import pino from "pino";
import { Bench } from "tinybench";
import winston from "winston";

import {
  createLogger,
  JsonFormatter,
  Severity,
  WriterTransport,
} from "../src/index.js";

let checksum = 0;
const metadata = {
  chargeId: "ch_42",
  amount: 5_000,
  currency: "USD",
};

const jamx = createLogger({
  minSeverity: Severity.Info,
  transport: new WriterTransport(new JsonFormatter(), (output) => {
    checksum += output.length;
  }),
});

const pinoLogger = pino(
  {
    base: null,
    level: "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  {
    write(output: string) {
      checksum += output.length;
    },
  },
);

const winstonSink = new Writable({
  write(chunk, _encoding, callback) {
    checksum += chunk.length;
    callback();
  },
});
const winstonLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Stream({ stream: winstonSink })],
});

const bench = new Bench({ name: "informational logger comparison", time: 1_000 });

bench
  .add("Jamx: JSON to in-memory writer", () => {
    jamx.info("charge completed", metadata);
  })
  .add("Pino: JSON to in-memory destination", () => {
    pinoLogger.info({ meta: metadata }, "charge completed");
  })
  .add("Winston: JSON to in-memory stream", () => {
    winstonLogger.info("charge completed", { meta: metadata });
  });

await bench.run();
console.table(bench.table());
console.log(`checksum: ${checksum}`);
