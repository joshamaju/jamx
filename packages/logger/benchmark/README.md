# Logger benchmarks

The core suite is a regression tool for `@jamx/logger` behavior:

```bash
pnpm run benchmark
```

The comparison suite provides informational Pino and Winston measurements:

```bash
pnpm run benchmark:comparison
```

Both suites use in-memory sinks so terminal, filesystem, and network I/O do not
dominate the results. The comparison uses the same message and metadata and
asks every logger to serialize JSON. It is still not a claim that the libraries
have identical semantics or delivery guarantees.

Benchmark results vary with Node.js version, operating system, CPU, background
load, and dependency versions. Record that environment when sharing results.
Do not use exact operations-per-second values as CI pass/fail thresholds on
shared runners.

The Node worker suite compares synchronous and worker-backed Jamx and Pino
delivery:

```bash
pnpm run benchmark:worker
```

It reports worker startup, main-thread enqueue throughput, end-to-end delivered
throughput, flush latency, and dropped records. It is separate from the ordinary
Pino/Winston table because enqueue speed alone can hide queue growth and delayed
delivery.

The architectures are not identical: Pino serializes JSON on the main thread
before passing strings through `thread-stream`; the Jamx example sends structured
records through Node's structured-clone protocol and formats them in its worker.
The comparison therefore represents each logger's worker model rather than an
identical internal pipeline.
