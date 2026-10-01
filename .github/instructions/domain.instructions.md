---
applyTo: "src/domain/**/*.ts,src/features/**/*.ts"
---

Read docs/DOMAIN-RULES.md before changing domain or feature behavior. Distinguish income, expense, own-account transfer, investment contribution, cash withdrawal, fees, interest, card purchase, and card settlement. Keep exact money semantics and currency explicit. Put period inclusion, classification, reconciliation, and totals in domain or application code rather than route components. Preserve explicit user corrections over imported hints and AI suggestions. Add focused tests with concrete dates and expected totals. If a rule is undecided, identify the example and ask for a product decision rather than guessing.
