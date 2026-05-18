---
"@jamx/http": patch
---

Fix interceptor composition for relative request inputs by keeping requests in normalized `{ input, init }` form until the terminal fetch handler runs. This allows `withBaseUrl` to resolve relative paths before a platform `Request` is constructed.
