# Agentic Engineering

Agents are assistants for implementation and review; the human remains the final approver. GitHub is the source of truth for code, decisions, and work history.

## Working rules

- Read this guidance and relevant docs before editing.
- Confirm baseline audit claims in current code.
- Prefer a small diff with focused tests and clear acceptance criteria.
- Never let AI determine financial arithmetic or silently change accounting semantics.
- Keep provider types at adapter boundaries and secrets server-side.
- Do not make production deployments, destructive data changes, or schema changes without explicit review.
- Report checks that were actually run and disclose unverified assumptions.

Specialist agents in `.github/agents/` are review-oriented and should identify evidence, risks, and concrete recommendations rather than expanding scope.
