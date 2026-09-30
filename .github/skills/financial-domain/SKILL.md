# Skill: Financial Domain

Before working on finance behavior, read `docs/DOMAIN-RULES.md` and inspect the relevant `src/domain` implementation. Keep arithmetic deterministic in integer minor units. Transfers are neither income nor expenses; contributions are allocations; invoice payments must not duplicate card expenses. Preserve currency and period semantics. Add focused regression tests. Never use an LLM to produce authoritative financial values.
