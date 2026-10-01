# Agentic Engineering

## Source of truth

GitHub issues are the executable backlog; milestones are delivery groupings; pull requests are the review boundary. The PRD, domain rules, architecture, security, testing, and integration documents hold durable context that does not fit in one issue. Issues describe one small, reviewable change and link to those canonical rules.

The current loop is: human defines outcome and acceptance -> implementation agent reads the issue and repository rules -> agent creates a focused branch and pull request -> deterministic CI runs -> specialist reviews identify domain, accessibility, Open Finance, or security risks -> human resolves open product decisions and approves merge. Deployment and production financial data access remain human-controlled.

## Agent boundaries

- Implementation agent may edit only the issue scope, explain decisions, add tests, and open a PR.
- Financial domain, accessibility, Open Finance, and security profiles are review-only unless the user explicitly changes the task.
- Review agents report evidence with file and line, severity, impact, and a concrete next step. They do not invent product rules.
- Agents do not access real bank credentials, production databases, provider consent, or household financial data.
- Agent output is untrusted until reviewed. CI, schema constraints, authorization, and deterministic code remain the enforcement mechanisms.

## Issue and PR contract

Every issue states user outcome, scope, explicit non-goals, acceptance criteria, domain references, data/security considerations, and verification. Implementation starts only after ambiguities that affect money semantics or data ownership are resolved. A PR links the issue, summarizes behavior and migrations, lists tests run, states remaining decisions, and includes screenshots only when they contain synthetic data.

Do not close an issue until its acceptance criteria are merged. Do not mark a milestone complete merely because its issues were created. Keep milestone issue dependencies explicit and sequence schema, domain logic, and UI changes deliberately.

## Automation progression

Start with the existing deterministic CI and manual review. Next validate custom agents on one low-risk issue and measure whether their review catches actionable findings. Add narrowly scoped automation only after permissions, branch behavior, artifact ownership, secrets access, retries, and human approval points are documented. Avoid autonomous deployment, arbitrary issue execution, broad write tokens, and multi-agent orchestration before the single-agent loop is reliable.

## Evaluation

For each agent workflow experiment, record task, context supplied, tools and permissions, expected checks, observed output, missed or false-positive findings, and human corrections. Use synthetic fixtures. An agent that produces plausible prose but misses a financial invariant has failed the evaluation.
