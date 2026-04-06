# jamx

`jamx` is a monorepo for small, composable TypeScript packages.

## Philosophy

The packages in this repository are built around a consistent set of ideas:

- small APIs over large frameworks
- composition over deeply coupled abstractions
- explicit types and structured data over hidden behavior
- utilities that stay useful on their own and compose well together

Each package should be understandable in isolation, practical in day-to-day
use, and easy to combine with the rest of the TypeScript ecosystem.

## Packages

- [`@jamx/http`](./packages/http): composable `fetch` helpers with interceptors, decoders, validation, and Railway-style results
- [`@jamx/logger`](./packages/logger): composable structured logging primitives for TypeScript and Node.js

## Repository Layout

```text
packages/
  http/
  logger/
.changeset/
```

## Getting Started

### Requirements

- Node.js 18+
- `pnpm` 10+

### Install

```bash
pnpm install
```

### Build Everything

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

## Working On A Package

Run package scripts from the package directory or by filtering with `pnpm`.

Examples:

```bash
pnpm --filter @jamx/http test
pnpm --filter @jamx/logger build
```

## Releasing

Versioning and publishing are automated with Changesets via GitHub Actions.

To propose a package release, add a changeset in your branch:

```bash
pnpm changeset
```

After that changeset is merged to `master`, the release workflow will create or
update the Changesets release PR. When that PR is merged, Changesets versions
and publishes the affected packages automatically.

## Package Documentation

- [`@jamx/http` docs](./packages/http/README.md)
- [`@jamx/logger` docs](./packages/logger/README.md)

## License

Each package includes its own license file.
