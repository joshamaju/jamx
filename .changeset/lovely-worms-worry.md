---
"@jamx/logger": minor
---

Rename the logger classes.`Logger` is now the convenience facade with level-specific methods like`info()`, `warn()`, and `error()`. The previous low-level `Logger`implementation is now `CoreLogger`, available through `createCoreLogger`.`ContextLogger`, `createContextLogger`, and the `.child()` method have beenremoved. Use `createChildLogger(logger, meta)` to derive a logger withadditional metadata.
