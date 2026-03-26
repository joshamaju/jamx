# jamx

TypeScript utilities published from a pnpm monorepo.

Current packages:

- `@jamx/http`: composable fetch helpers with interceptors, decoders, validators, and Railway-style results
- `@jamx/logger`: composable structured logging primitives for TypeScript and Node.js

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Run a package script directly:

```bash
pnpm --filter @jamx/http test
pnpm --filter @jamx/logger build
```

Packages live in `packages/*`.
