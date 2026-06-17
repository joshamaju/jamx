import {
  createNamedLogger,
  Formatter,
  LineConsoleTransport,
  LogRecord,
  Severity,
} from "../src/index.js";
import spinner from "elegant-spinner";

const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";
const ANSI_MAGENTA = "\u001b[35m";

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case Severity.Silly:
      return ANSI_DIM;
    case Severity.Trace:
      return ANSI_CYAN;
    case Severity.Debug:
      return ANSI_BLUE;
    case Severity.Info:
      return ANSI_GREEN;
    case Severity.Warn:
      return ANSI_YELLOW;
    case Severity.Error:
      return ANSI_RED;
    case Severity.Fatal:
      return ANSI_MAGENTA;
    default:
      return "";
  }
}

function maybeColorize(
  value: string,
  color: string,
  colorize: boolean,
): string {
  return colorize ? `${color}${value}${ANSI_RESET}` : value;
}

class LineFormatter implements Formatter {
  format(log: LogRecord): string {
    const colorize = true;
    const severity = maybeColorize(
      log.severityName.toUpperCase().padEnd(5, " "),
      getSeverityColor(log.severity),
      colorize,
    );

    const metaOutput =
      Object.entries(log.meta).length > 0
        ? ` ${maybeColorize("|", ANSI_DIM, colorize)} ${Object.entries(log.meta)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ")}`
        : "";

    return `${severity} ${log.message}${metaOutput}`;
  }
}

const logger = createNamedLogger({
  name: "tasks",
  minSeverity: Severity.Debug,
  transport: new LineConsoleTransport({
    formatter: new LineFormatter(),
    interactive: true,
  }),
});

logger.info("Syncing user", { lineId: "user_42" });
logger.info("Fetching organization", { lineId: "org_12" });

await new Promise((resolve) => setTimeout(resolve, 750));

logger.info("Syncing user details", { lineId: "user_42" });

await new Promise((resolve) => setTimeout(resolve, 750));

logger.info("Fetched organization", {
  lineId: "org_12",
  finalize: true,
});

logger.debug("Synced user", {
  lineId: "user_42",
  finalize: true,
});

const tasks = Array.from({ length: 3 }, async (_, index) => {
  const frame = spinner();
  const lineId = `spinner_${index}`;
  const interval = setInterval(() => {
    logger.info(`${frame()} Loading ${index}`, { lineId });
  }, 60);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  clearInterval(interval);
  logger.info(`Finished loading ${index}`, { lineId, finalize: true });
});

await Promise.all(tasks);
