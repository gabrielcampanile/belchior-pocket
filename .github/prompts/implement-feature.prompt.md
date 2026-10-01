---
name: implement-feature
description: Implements one approved Belchior Pocket issue while preserving financial, security, and accessibility invariants.
---

Read the linked issue and repository instructions, then consult the relevant canonical docs. Confirm the user outcome, acceptance criteria, explicit non-goals, affected domain events, ownership boundary, currency and period policy, and migration needs. If a missing decision changes money semantics or access to personal data, stop implementation of that behavior and report the decision needed.

Inspect current code and callers. Implement the smallest coherent change in the existing stack. Keep provider, database, and AI payloads behind their boundaries. Add or update focused synthetic tests for financial behavior and authorization. Do not include unrelated cleanup or change generated files by hand.

Before proposing completion, run the applicable lint, type, test, and build checks. Report exact commands and results. Create a focused pull request linked to the issue, describe schema and privacy effects, identify unresolved questions, and leave merge approval to the human.
