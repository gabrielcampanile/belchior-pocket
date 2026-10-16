---
inclusion: always
---

# Structure

```
src/
  routes/                  index (Mês atual), transacoes, relatorios, conexoes, auth
  components/finance/      app components (CategoryBudgetEditor, TransactionDialog, CategoryDonut, primitives)
  components/ui/           shadcn/ui (do not edit casually)
  domain/                  pure financial logic: cashflow, transactions, exchange, currency
  hooks/                   TanStack Query data hooks (useCashflow, useTransactions, useOpenFinanceSync, useCurrency)
  integrations/
    open-finance/          Pluggy adapter, pure sync plan, categories, *.server.ts persistence
    supabase/              clients, auth middleware, generated types.ts
  lib/                     server functions (*.functions.ts), *.server.ts, formatting, months
supabase/migrations/       forward-only SQL
docs/                      PRD, DOMAIN-RULES, DATA-MODEL, ROADMAP, DEPLOY, ...
legacy/lovable-screens/    old screens, outside the build — visual reference only
.github/                   CI, Copilot instructions, review agents, skills, prompts
```

Rules of thumb:

- `src/domain` imports nothing from React, Supabase or Pluggy.
- Query keys for Open Finance data live under `OPEN_FINANCE_QUERY_KEY`, so a sync refreshes
  every screen.
- New screens reuse `components/finance/primitives` (`PageHeader`, `Panel`, `MetricValue`,
  `EmptyState`) and theme tokens; no hard-coded colors.
