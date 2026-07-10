---
title: Examples
description: Run the @jamx/logger example programs.
---

Run examples from the `packages/logger` directory:

```bash
pnpm run example:basic
pnpm run example:structured
pnpm run example:writer-pretty
pnpm run example:context
pnpm run example:processor
pnpm run example:memory
pnpm run example:composite
pnpm run example:formatter
pnpm run example:printf
pnpm run example:line
```

## Example Files

- `basic.ts`: named console logger with pretty output.
- `structured.ts`: JSON output and structured metadata.
- `writer-pretty.ts`: pretty output written to stderr with `WriterTransport`.
- `context.ts`: inherited metadata with child loggers.
- `processor.ts`: redaction and enrichment with a processor.
- `memory.ts`: capture logs in memory.
- `composite-transport.ts`: write one record to multiple transports.
- `custom-formatter.ts`: implement a formatter.
- `printf.ts`: interpolate printf-style messages.
- `line-console.ts`: update stable terminal lines.
