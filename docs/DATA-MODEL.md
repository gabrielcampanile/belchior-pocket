# Data Model Direction

This document records target concepts, not a schema migration specification. Verify names and constraints against current migrations before implementation.

## Existing ledger concepts

The current application has accounts, categories, transactions, balances, closures, and planning concepts. Transactions are the common ledger for both income and expenses; preserve integer minor units and the existing unified ledger approach.

## Target concepts to add only with reviewed migrations

- Stable provider identity for accounts and transactions, scoped by provider and connection.
- Sync status, timestamps, and error metadata separated from user-owned fields.
- Explicit user override tracking for manually edited category/description fields.
- Transfer pairing between owned accounts.
- Credit card account terms, invoice cycles, installment groups, and invoice settlement links.

## Modeling constraints

Provider payloads are not domain records. External identities must support safe upsert and pending-to-posted reconciliation. Never rely solely on a short content hash as a unique transaction identity. User edits must not be overwritten by refresh. Invoice settlement must be distinguishable from purchase expense. Do not implement these target concepts as part of this documentation milestone.
