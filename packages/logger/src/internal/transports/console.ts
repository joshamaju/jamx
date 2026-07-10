import { Formatter, Severity } from "../core.js";
import { LogWriter, WriterTransport } from "./writer.js";

const writeToConsole: LogWriter = (output, log) => {
  if (log.severity >= Severity.Warn) {
    console.error(output);
    return;
  }

  console.log(output);
};

export class ConsoleTransport extends WriterTransport {
  constructor(formatter: Formatter) {
    super(formatter, writeToConsole);
  }
}
