import { Bench } from "tinybench";

import {
  CompositeProcessor,
  CompositeTransport,
  createChildLogger,
  createLogger,
  ErrorProcessor,
  JsonFormatter,
  PrettyFormatter,
  RedactProcessor,
  Severity,
  WriterTransport,
} from "../src/index.js";

let checksum = 0;
const write = (output: string) => {
  checksum += output.length;
};

const jsonTransport = new WriterTransport(new JsonFormatter(), write);
const baseLogger = createLogger({
  minSeverity: Severity.Debug,
  meta: { service: "payments" },
  transport: jsonTransport,
});
const filteredLogger = createLogger({
  minSeverity: Severity.Warn,
  transport: jsonTransport,
});
const childLogger = createChildLogger(baseLogger, {
  requestId: "req_42",
  tenantId: "tenant_7",
});
const prettyLogger = createLogger({
  transport: new WriterTransport(
    new PrettyFormatter({ colorize: false }),
    write,
  ),
});
const processedLogger = createLogger({
  transport: jsonTransport,
  processor: new CompositeProcessor([
    new ErrorProcessor(),
    new RedactProcessor(["authorization", "password"]),
  ]),
});
const fanoutLogger = createLogger({
  transport: new CompositeTransport([
    new WriterTransport(new JsonFormatter(), write),
    new WriterTransport(new JsonFormatter(), write),
    new WriterTransport(new JsonFormatter(), write),
    new WriterTransport(new JsonFormatter(), write),
    new WriterTransport(new JsonFormatter(), write),
  ]),
});
const circular: Record<string, unknown> = { id: "node_1" };
circular.self = circular;

const bench = new Bench({ name: "@jamx/logger core", time: 1_000 });

bench
  .add("filtered below minSeverity", () => {
    filteredLogger.info("ignored", { requestId: "req_42" });
  })
  .add("message without metadata", () => {
    baseLogger.info("charge completed");
  })
  .add("small flat metadata + JSON", () => {
    baseLogger.info("charge completed", {
      chargeId: "ch_42",
      amount: 5_000,
      currency: "USD",
    });
  })
  .add("nested metadata + JSON", () => {
    baseLogger.info("request completed", {
      request: {
        id: "req_42",
        route: "/charges",
        headers: { accept: "application/json" },
      },
    });
  })
  .add("child metadata + JSON", () => {
    childLogger.info("request completed", { durationMs: 18 });
  })
  .add("pretty formatter", () => {
    prettyLogger.info("request completed", {
      requestId: "req_42",
      durationMs: 18,
    });
  })
  .add("error normalization + redaction", () => {
    processedLogger.error("request failed", {
      error: new Error("database unavailable"),
      headers: { authorization: "Bearer secret" },
    });
  })
  .add("five composite destinations", () => {
    fanoutLogger.info("fan out", { requestId: "req_42" });
  })
  .add("circular metadata + JSON", () => {
    baseLogger.info("graph visited", { circular });
  });

await bench.run();
console.table(bench.table());
console.log(`checksum: ${checksum}`);
