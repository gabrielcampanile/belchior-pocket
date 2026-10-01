---
name: open-finance
description: Safely normalize, synchronize, and reconcile data from financial data providers.
---

# Purpose

Read docs/OPEN-FINANCE.md, docs/SECURITY.md, and docs/DOMAIN-RULES.md before changing an integration. Provider choice is an explicit product decision; Pluggy / Meu Pluggy remains a candidate until confirmed.

# Workflow

1. Define the provider operation and failure modes from its official contract.
2. Keep credentials and SDK calls on the server behind a provider adapter.
3. Normalize provider records into validated canonical DTOs.
4. Persist provider-scoped identities and reconciliation state.
5. Make replay, retry, pagination, and webhook handling idempotent.
6. Preserve user corrections during provider refresh.
7. Record safe sync-run metadata and show freshness and recovery to the user.
8. Cover representative success, malformed, duplicate, transient, consent, and ownership cases with synthetic fixtures.

# Invariants

Stable identity is scoped by provider connection and resource type. Date plus amount or a short hash alone is not a safe unique key. Pending-to-posted changes must not double count. Provider refresh must not overwrite user-owned fields. Only transient failures are retried within a bound. Secrets and full payloads are not logged.

# Anti-patterns

Do not make provider SDK types the domain model. Do not put credentials in client state or prompts. Do not blindly retry consent errors. Do not advance a sync cursor before processed data is durable. Do not assume webhook delivery order or exactly-once delivery.

# Verification

Inspect server boundary, ownership, RLS, migrations, redaction, replay behavior, and the tests together. Report provider behavior not verified against official documentation or a sandbox.
