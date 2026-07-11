import build from "pino-abstract-transport";

export default async function createDiscardTransport() {
  return build(async (source) => {
    for await (const _record of source) {
      // Parse and consume every record without external I/O.
    }
  });
}
