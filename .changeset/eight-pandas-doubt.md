---
"@jamx/logger": patch
---

Add built-in log processors.

Adds `CompositeProcessor`, `DefaultsProcessor`, `RedactProcessor`, and `ErrorProcessor`, plus a new `@jamx/logger/Processor` subpath export. These processors support composing processor pipelines, adding default metadata, redacting configured metadata values without changing field names, and normalizing `Error` values.
