import "dotenv/config";

import bodyParser from "body-parser";
import compression from "compression";
import express, { static as static_ } from "express";
import { createServer } from "http";
import methodOverride from "method-override";
import logger from "morgan";
import { WebSocket, WebSocketServer } from "ws";

import {
  ConsoleTransport,
  CoreLogger,
  Logger,
  PrettyFormatter,
  Severity,
  type LogRecord,
  type Transport,
} from "../../src/index.js";

import { engine, View } from "@stack54/express/view";

import { resolver } from "../build/server/entry.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const sockets = new Set<WebSocket>();

class OutboundTransport implements Transport {
  capture(log: LogRecord): void {
    sockets.forEach((_) => _.send(JSON.stringify({ type: "log", log })));
  }
}

const out_logger = new Logger(
  new CoreLogger({
    transport: new OutboundTransport(),
    minSeverity: Severity.Trace,
  }),
);

const in_logger = new Logger(
  new CoreLogger({
    transport: new ConsoleTransport(new PrettyFormatter({ colorize: true })),
    minSeverity: Severity.Trace,
  }),
);

app.engine("svelte", engine);
app.set("view engine", "svelte");
app.set("view", View({ resolve: resolver }));

app.use(logger("dev"));
app.use(compression());
app.use(methodOverride());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const serve_build_assets = static_("./build", {
  immutable: true,
  maxAge: "1y",
});

app.use(serve_build_assets);

app.use(static_("./resources/static", { maxAge: "1h" }));

app.get("/", (_, res) => {
  return res.render("home", {});
});

const port = process.env.PORT || 3000;

let started = false;

wss.on("connection", function connection(ws) {
  in_logger.info("New client connected");

  sockets.add(ws);

  let interval: NodeJS.Timeout | undefined;

  ws.on("message", function message(data) {
    const message = data.toString();
    const event = JSON.parse(message);

    if (event.type == "start" && !started) {
      interval = setInterval(
        () => out_logger.info("Server log", { id: "server" }),
        1000,
      );
      started = true;
    }

    if (event.type == "log") {
      const record = event.log as LogRecord;
      in_logger.log(record.severity, record.message, record.meta);
    }
  });

  ws.on("close", function close() {
    in_logger.debug("Client disconnected");
    if (interval) clearInterval(interval);
    sockets.delete(ws);
  });
});

server.listen(port, () => {
  console.log(`✅ app ready: http://localhost:${port}`);
});
