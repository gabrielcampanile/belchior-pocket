---
applyTo: "supabase/migrations/**/*.sql,src/integrations/supabase/**/*.ts"
---

Read docs/DATA-MODEL.md and docs/SECURITY.md before database changes. Inspect the live migration history, generated types, callers, foreign keys, indexes, deletion behavior, and RLS policies. Every personal record needs an owner boundary enforced in the database and server. Treat service-role operations as privileged server code. Use forward migrations, prove owner access and non-owner denial, and regenerate types from the authoritative schema process rather than hand-editing them.
