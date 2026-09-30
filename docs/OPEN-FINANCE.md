# Open Finance

## Boundary

The application should depend on an internal provider contract and canonical models, not on Pluggy-specific types. Provider adapters authenticate and fetch external data, normalize it, and map external identities to internal records.

## Synchronization behavior

- Upserts must be idempotent using a provider-scoped stable external identity where available.
- Handle pending-to-posted reconciliation without creating a second transaction.
- Provider refresh may update provider-owned fields, but must preserve user overrides.
- Support historical import and incremental/current-period sync.
- Track last attempt, last success, status, and safe error details.
- Retries must be bounded and safe to repeat.

## Security

Keep provider credentials and privileged database credentials server-side. Minimize persisted raw payloads and redact secrets and sensitive transaction details from logs. Enforce user ownership at persistence boundaries and review RLS policies with any schema change.

## Rollout

First define the provider interface and canonical models; then implement an adapter and connection lifecycle; then account sync, transaction normalization, idempotency, reconciliation, and user override preservation. Do not begin provider integration before the domain identity and schema decisions are reviewed.
