---
applyTo: "src/integrations/open-finance/**/*.ts,src/features/open-finance/**/*.ts"
---

Read docs/OPEN-FINANCE.md, docs/DOMAIN-RULES.md, and docs/SECURITY.md before changing synchronization. Keep provider SDKs, tokens, payload shapes, status codes, and webhook details behind a server-side adapter. Normalize into validated canonical models and use stable provider-scoped IDs. Make replay safe, reconcile pending-to-posted records, preserve user corrections, and advance cursors only after durable processing. Retry bounded transient errors only. Do not log secrets or real transaction payloads. Add synthetic fixtures for duplicates, malformed input, consent failure, replay, and recovery.
