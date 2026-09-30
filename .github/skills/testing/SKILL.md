# Skill: Testing

Inspect current scripts and test conventions before adding tests. Prefer pure unit tests for domain rules and deterministic fixtures. Cover both expected outcomes and financial edge cases. Integration tests for sync should verify idempotency, ownership, override preservation, and settlement reconciliation without real account data. Do not assert implementation details when a behavior-level assertion is available.
