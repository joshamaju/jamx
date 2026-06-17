import { Terminal } from "@xterm/xterm";
import {
  CompositeTransport,
  CoreLogger,
  Logger,
  type LogRecord,
  PrettyFormatter,
  Severity,
  type Transport,
} from "../../../build/index.js";

const ws = new WebSocket("ws://localhost:3000");

const container = document.getElementById("terminal");
const terminal = new Terminal();

terminal.open(container);

const pretty_formatter = new PrettyFormatter({ colorize: true });

class WSTransport implements Transport {
  capture(log: LogRecord): void {
    ws.send(JSON.stringify({ type: "log", log }));
  }
}

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case Severity.Silly:
      return "grey";
    case Severity.Trace:
      return "cyan";
    case Severity.Debug:
      return "blue";
    case Severity.Info:
      return "green";
    case Severity.Warn:
      return "yellow";
    case Severity.Error:
      return "red";
    case Severity.Fatal:
      return "magenta";
    default:
      return "";
  }
}

class PrettyTransport implements Transport {
  capture(log: LogRecord): void {
    const severityLabel = log.severityName.toUpperCase().padEnd(5, " ");

    const severityColor = getSeverityColor(log.severity);

    const severity = `%c${severityLabel}`;

    const timestamp = `%c${log.timestamp.toISOString()}`;

    const metaOutput =
      Object.entries(log.meta).length > 0
        ? ` %c| %c${Object.entries(log.meta)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(" ")}`
        : "";

    console.log(
      `${timestamp} ${severity} %c${log.message}${metaOutput}`,
      `color: grey`,
      `color: ${severityColor}`,
      "color: black",
      "color: grey",
      "color: black",
    );
  }
}

class XTermTransport implements Transport {
  capture(log: LogRecord): void {
    terminal.writeln(pretty_formatter.format(log));
  }
}

const out_logger = new Logger(
  new CoreLogger({ transport: new WSTransport(), minSeverity: Severity.Trace }),
);

const logger = new Logger(
  new CoreLogger({
    minSeverity: Severity.Trace,
    transport: new CompositeTransport([
      //   new ConsoleTransport(new TextFormatter()),
      new PrettyTransport(),
      new XTermTransport(),
    ]),
  }),
);

ws.onmessage = function (e) {
  const message = e.data.toString();
  const event = JSON.parse(message);

  if (event.type == "log") {
    const record = event.log as LogRecord;
    logger.log(record.severity, record.message, record.meta);
  }
};

ws.onopen = function () {
  ws.send(JSON.stringify({ type: "start" }));
  setInterval(() => out_logger.info("Client log", { id: "client" }), 1000);
};
