# Open Finance fixtures

Redacted captures of the **real** Pluggy API response (XP + Wise items, 2026-10-08), used
as deterministic contract fixtures for the Pluggy adapter (BP-025) and sync tests.

**Redaction:** every monetary value is zeroed (`balance`, `amount`, `creditLimit`, …) and
every PII/identity string is replaced with `"<redacted>"` (names, account numbers,
`taxNumber`, `owner`, `providerId`, `id`, merchant, payer/receiver, bank data). What is
preserved — and what the tests assert against — is the **structure**: field names, nesting,
and the enum-like values that drive normalization (`type` CREDIT/DEBIT, `status`
POSTED/PENDING, `category`, `categoryId`, `operationType`, `currencyCode`, account
`type`/`subtype`).

Raw, un-redacted captures are **never** committed; they live only in the session scratch
dir during capture. Do not add real balances or PII here.

| File | From |
|---|---|
| `xp.accounts.fixture.json` | `GET /accounts?itemId=<xp>` |
| `wise.accounts.fixture.json` | `GET /accounts?itemId=<wise>` (BRL/CAD/ARS/EUR) |
| `xp.v2transactions.fixture.json` | `GET /v2/transactions?accountId=<xp checking>` (8 rows) |
