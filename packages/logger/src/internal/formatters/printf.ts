import fmt from "@paydirt/fmt";
import { LogRecord } from "../core.js";
import { TextFormatter } from "./text.js";

export class PrintfFormatter extends TextFormatter {
  format(log: LogRecord): string {
    const formatted = fmt.sprintf(log.message, ...Object.values(log.meta));
    return super.format({ ...log, message: formatted });
  }
}
