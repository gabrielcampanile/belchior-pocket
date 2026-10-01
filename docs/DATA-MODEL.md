# Data Model

This document describes conceptual ownership and invariants. It is not permission to duplicate or rename existing tables without inspecting migrations and generated database types. Update the model after reviewing the live repository schema.

## Concepts

- User profile and settings: authenticated identity, display preferences, base currency preference, and household choice where decided.
- Financial account: owned account with kind, institution metadata, currency, status, and optional provider mapping.
- Provider connection: provider, consent state, external connection identity, safe sync metadata, and owner.
- Account balance: point-in-time amount, currency, effective timestamp, and source. Current balance is not interchangeable with transaction-derived balance.
- Transaction: economic event with explicit type, amount, currency, effective and posting dates, account, state, category, source, and user ownership.
- Provider transaction mapping: stable provider-scoped identity and canonical transaction association, including reconciliation state.
- Category: owner or system scope, display name, applicable transaction type, and lifecycle.
- Categorization rule: owner, match operator and value, applicable transaction type, target category, priority, and provenance.
- Card statement and statement item: account, period, close and due dates, item references, amounts, and settlement state.
- Budget: owner, period, currency, category, planned amount, and the policy used for actuals.
- Period closure: period and closure metadata only when its late-data and correction semantics are defined.
- Sync run: connection, requested range or cursor, status, safe error, timing, counts, and retryability.
- Exchange rate: source, pair, rate, effective date, and retrieval metadata if multi-currency aggregation is introduced.

## Ownership and relationships

Every user-visible personal record must be traceable to an authenticated owner. Connections own provider accounts; provider accounts map to canonical accounts; imported transaction identities map to canonical transactions. A provider ID is unique only within its documented provider, connection, and resource scope.

Transactions may reference one account and optionally a related account or transfer group. Card purchases and statement payments must remain distinguishable. Installments share a purchase group but have separate due occurrences. Categories and rules must not cross household ownership boundaries.

## Data invariants

- Amount and currency travel together.
- A transfer is represented once as a grouped movement with its two account effects, or through another explicitly documented representation that cannot be counted as income or expense.
- A card settlement cannot be aggregated as new spending.
- Imported IDs and user corrections remain available after provider refresh.
- Soft deletion, archival, provider disconnect, and data erasure semantics must be explicit.
- Balances need source and effective time; an unqualified number is ambiguous.
- Query limits and pagination must not silently truncate financial history.

## Schema change checklist

Before migration, inspect the current schema and callers. Define ownership foreign keys, unique constraints, deletion behavior, indexes, RLS policies, and backfill behavior. Explain impact on imported or user-corrected records. Update generated types from the schema and add tests for both allowed and denied access. Never assume conceptual names in this document already exist in production.
