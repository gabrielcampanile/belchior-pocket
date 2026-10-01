# Open Finance

## Purpose and boundary

Open Finance reduces month-end manual entry and makes current activity visible. Provider connectivity is an infrastructure boundary, not the owner of the product domain. Pluggy / Meu Pluggy is an MVP candidate only; choosing it requires confirmation of coverage, consent UX, pricing, operational limits, data retention, and support.

Keep provider-specific API clients, credentials, webhooks, response shapes, and status codes inside an adapter. Convert provider data into canonical account, balance, transaction, card, and sync-run models before applying domain behavior. Domain code must not import provider SDKs or provider-generated types.

## Connection lifecycle

1. The authenticated user starts a connection through a server-side flow.
2. The server validates ownership and obtains or refreshes provider state using server-only credentials.
3. Consent state and expiry are visible; revoked, expired, and failed connections are recoverable states.
4. Account discovery creates or reconciles canonical accounts with provider-scoped identity.
5. Synchronization uses a bounded time window and saves its run outcome.
6. UI presents last successful sync, current status, and a safe recovery action.
7. Disconnecting a provider revokes consent where supported and removes or disables credentials according to retention policy.

Never expose provider secrets, access tokens, refresh tokens, or unrestricted service-role credentials in a browser bundle, client log, issue, agent prompt, or test fixture.

## Normalization

- Store provider identity as provider name, connection identity, resource type, and stable external ID.
- Normalize amount, currency, transaction and posting dates, pending or posted status, merchant description, account, and provider transaction type.
- Preserve the raw payload only where a documented reconciliation need justifies it, access is restricted, retention is defined, and sensitive fields are redacted from logs.
- Normalize timestamps with explicit timezone assumptions. A provider date-only value is not an instant.
- Retain the provider's transaction type and canonical classification separately.
- Reject unknown or malformed currency, amount, account ownership, and status values safely.

## Idempotency and reconciliation

- Replaying the same page or webhook must not create another account, transaction, or balance event.
- Stable provider IDs are connection-scoped and may not be reused across institutions.
- Pending-to-posted updates should update or reconcile the existing economic event where identity or a deliberate matching policy supports it.
- Do not use amount plus date or description alone as a unique key.
- Preserve user category, description, and other explicit corrections when provider data refreshes.
- Define conflict behavior when a provider changes an amount, reverses an item, or returns duplicate records.
- Persist cursor or synchronization range only after the corresponding page is durably processed.

## Sync operations

Persist sync run start and completion time, requested range or cursor, outcome, safe error code, retryability, and counts. Do not persist full secrets or sensitive payloads in operational logs.

Retry only transient network, throttling, or provider availability failures. Use bounded exponential backoff with jitter and respect provider retry hints. Consent, authentication, permission, and validation errors require user or operator action. Repeated sync requests must be safe.

The first product interaction is user-triggered sync. A daily background schedule may be added later with rate limits, stale-connection handling, monitoring, and user-visible freshness expectations. Initial history should target January of the current year when the provider supports it; confirm actual provider limits before promising this behavior.

## Security and privacy

- Perform provider calls on the server.
- Validate the authenticated owner for every connection, account, sync run, and imported record.
- Use row-level security for user-visible stored data and tightly isolate any service-role operation.
- Restrict callback URLs and verify webhook signatures, timestamps, and replay behavior.
- Minimize data sent to optional categorization services.
- Do not use real financial data in automated test fixtures, public issues, or agent context.

## Provider acceptance checklist

Before selecting or changing a provider, record supported institutions and account types, card and installment coverage, history window, refresh behavior, consent duration and revoke semantics, webhook guarantees, rate limits, pricing, sandbox availability, data location and retention, and operational support. Add a contract fixture for representative payloads and failure modes. Provider selection is not implied by this document.
