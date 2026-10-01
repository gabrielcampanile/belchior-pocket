---
name: testing
description: Choose focused tests that protect Belchior Pocket financial and privacy invariants.
---

# Workflow

Start with the issue acceptance criteria and docs/TESTING.md. Identify the invariant that could be violated, the layer where it belongs, and at least one negative or boundary case. Prefer deterministic unit tests for calculations, application tests for orchestration and ownership, integration tests for provider and persistence behavior, and UI tests for accessible interaction.

Use synthetic fixtures with explicit currency, dates, status, identity, owner, and expected totals. Include duplicate import and later correction where synchronization is involved. For access-control changes, prove both owner access and non-owner denial.

# Quality rules

Tests should fail for the targeted regression and avoid relying on wall-clock time, network availability, real credentials, real banking records, or ordering accidents. Assert financial meaning and persisted result rather than private implementation details. Keep tests close to the domain or feature they protect.

# Anti-patterns

Do not weaken assertions to make a change pass. Do not share secrets or real transaction payloads. A build passing is not a substitute for behavioral tests. Do not claim commands passed when they were not run.
