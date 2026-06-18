import {
  ConsoleTransport,
  CompositeProcessor,
  createNamedLogger,
  DefaultsProcessor,
  PrettyFormatter,
  RedactProcessor,
  Severity,
} from "../src/index.js";

const logger = createNamedLogger({
  name: "auth",
  minSeverity: Severity.Info,
  processor: new CompositeProcessor([
    new DefaultsProcessor({ source: "processor-example" }),
    new RedactProcessor(["token"]),
  ]),
  transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
});

logger.info("Session created", {
  userId: "user_42",
  token: "secret-token",
});
