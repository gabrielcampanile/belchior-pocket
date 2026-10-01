# Product Requirements Document

## Product and audience

Belchior Pocket is a personal and household finance workspace for understanding recent financial activity, following the current month, and making practical plans from reliable numbers. The first audience is one household. A partner may use the same financial space, but the product does not yet require organization management, roles, invitations, or a multi-tenant administration system.

The first release should solve the user's recurring problem: manually reconstructing transactions at month end gives a delayed snapshot and makes it difficult to see how spending is changing while the month is in progress. The app should reduce manual entry, preserve user corrections, and make the current financial picture understandable.

## Product principles

1. Correct financial meaning comes before visual polish or AI suggestions.
2. Imported provider data and user-entered data must have a clear source and history.
3. A transfer between the user's own accounts is never income or spending.
4. A card purchase is spending when the purchase occurs; paying its invoice must not count that spending again.
5. Calculations are deterministic and auditable. AI may suggest classification or explain data, but it never supplies financial arithmetic.
6. Integrations are replaceable boundaries. The domain model must not depend on one Open Finance provider.
7. Users can correct imported records and those corrections survive future synchronization.
8. Personal financial data is private by default and scoped to the household's authenticated data.
9. Mobile use is a first-class web experience; a native application is outside V1.

## V1 outcome

A user can connect supported financial institutions through an Open Finance provider, see normalized activity as it arrives, correct categories and details, follow cash flow and budgets during the month, and review reliable monthly history. Manual entry and import remain available as complementary sources.

## Functional requirements

### Identity and financial space

- Authenticate users and associate private records with the correct owner.
- Support one household financial space for the initial release.
- Do not add generalized teams, invitations, role administration, or complex tenant hierarchy without a product decision.
- Make account and provider connection status understandable and recoverable.

### Accounts and balances

- Represent checking, savings, cash, credit card, investment, and other supported account kinds explicitly.
- Keep institution, provider connection, account identity, currency, and current balance distinct.
- Preserve the provider's last-known balance and synchronization time where available.
- Do not add balances across currencies without an explicit conversion rate and rate date.
- Treat account selection and ownership checks as part of every data access path.

### Transactions and ledger

- Support income, expense, own-account transfer, cash withdrawal, card purchase, card payment, investment contribution, fee, and interest as distinct domain meanings.
- Store money with exact decimal or integer minor-unit semantics; never use binary floating point as the canonical amount.
- Keep transaction date, posting date, status, currency, account, source, merchant/description, category, and stable external identity where applicable.
- Manual records can be edited and deleted according to explicit domain policy; imported records can be corrected without losing provider identity or correction provenance.
- Filter and search by period, account, category, type, status, and source.
- Handle pending and posted records without counting both as separate spending when a provider later confirms the pending item.

### Credit cards and installments

- Model card accounts, limit, statement closing day, due day, statements, statement items, payment, and reconciliation separately.
- Count a purchase or each installment as an expense in the period in which it is due under the agreed product rule.
- A payment against the card statement settles a liability and is not a second expense.
- A purchase split into three installments of R$300 has three R$300 occurrences linked to one purchase group; it is not one R$900 monthly occurrence.
- Reconcile imported card transactions with statement items and payments without double counting.
- Refund and reversal behavior remains an explicit future decision; do not invent it during implementation.

### Open Finance and synchronization

- Treat Pluggy / Meu Pluggy as an MVP candidate, not as a dependency of the domain.
- Keep provider authentication, consent, account discovery, balance retrieval, transaction retrieval, and webhook handling behind a provider adapter.
- Normalize provider payloads into canonical account, balance, transaction, and status models before applying domain rules.
- Persist provider-scoped stable external identifiers. Do not deduplicate solely by a short hash, date and amount, or description.
- Synchronize incrementally where possible; define an initial import window with the provider, with January of the current year as the target if supported.
- Reconcile pending-to-posted transitions and preserve category, description, and other user corrections.
- Store synchronization run status, safe error codes, time range, counts, and retryability without logging credentials or full financial payloads.
- A user-triggered synchronization is the initial interaction. Daily background synchronization is a later operational improvement unless a milestone explicitly adds it.
- Retry bounded transient failures. Do not retry permanent consent, credential, or validation errors indefinitely.

### Categorization

- Apply deterministic merchant mappings and user-defined rules before any optional AI classification.
- Support rule matching concepts such as exact equality, prefix, substring, and regular expression only with safe validation.
- Rules must state the transaction type they apply to; do not silently force all rules to expenses.
- Store the selected category, classification source, confidence where available, and whether the user overrode the suggestion.
- A user correction must take precedence on future imports of the same transaction and must not be overwritten by a later suggestion.
- Optional AI is a fallback for uncertain cases, sends the smallest useful description and merchant context, and returns a suggestion for user confirmation or review.
- Groq is an example the user mentioned, not a selected provider or a V1 requirement.
- AI output is untrusted input and cannot trigger financial actions or alter amounts, dates, account ownership, or calculated totals.

### Monthly view, budgets, and planning

- Show income, expenses, monthly result, savings rate, budgets versus actual, investment contributions, recent activity, and notable category spending.
- Monthly result is income minus expenses. Own-account transfers and investment contributions are excluded from income and expense totals.
- Support category budgets and show spent, remaining, and variance with clearly stated treatment of pending items.
- Support a user-defined monthly contribution target as a planning indicator, not as income or expense.
- Provide monthly and historical views, with year, semester, and custom ranges where practical.
- Separate observed actuals from projections and label projected values clearly.
- Complex net-worth forecasting, advanced goals, and broad wealth analytics are future scope.

### Editing, accessibility, and responsive use

- Make transaction correction discoverable from the transaction list and details.
- Provide accessible labels, keyboard operation, visible focus, understandable validation, and announced asynchronous state.
- Support narrow mobile viewports for the primary tasks: review spending, search, correct a category, inspect sync, and see the monthly result.
- Do not introduce a native mobile application requirement in V1.

## Non-goals for V1

- Full net-worth management or a comprehensive assets-and-liabilities ledger.
- Advanced projections, scenario planning, retirement planning, or investment advice.
- A chatbot or autonomous financial agent that changes data.
- Advanced generative-AI insight reports.
- General-purpose multi-tenant administration or configurable household role matrices.
- Full offline synchronization, native iOS or Android applications, monetization, or public launch readiness.
- Refund and reversal accounting until the product decision is documented.
- Automatic daily synchronization unless an issue explicitly scopes it.

## Success criteria

- A user can understand current-month income, expenses, and result without exporting and manually reconciling a spreadsheet.
- Own-account transfers, investment contributions, card payments, installments, and pending-to-posted updates do not create double-counted monthly spending.
- Imported activity is traceable to its source and stable provider identity.
- User edits and category overrides survive later synchronization.
- Budget actuals and monthly totals can be explained from the underlying included transactions.
- Authentication and row-level authorization prevent access to another user's financial records.
- Primary mobile workflows are usable with keyboard and assistive technology.
- CI checks lint, types, tests, and production build for every proposed change.

## Preserved feature proposal

The detailed transaction-income consolidation proposal is preserved in [docs/reference/finance/transaction-income-consolidation.md](reference/finance/transaction-income-consolidation.md). Treat it as a feature proposal and code inventory that must be reconciled with the current schema and code before implementation; its original status claims may have changed.

## Milestone relationship

The GitHub milestones and issues are the execution backlog. This PRD is the canonical product intent and domain outcome; issues should link back to it and define one reviewable implementation slice. M0 establishes project foundations and agent workflow. M1 establishes domain correctness and transaction management. M2 establishes accounts and connection boundaries. M3 implements Open Finance synchronization. M4 adds reliable monthly tracking, budgets, and planning indicators. M5 hardens accessibility, security, and release behavior. M6 remains unplanned until future scope is chosen.

## Decisions that must remain explicit

- Whether refunds and reversals are included and how they affect period totals.
- Which Open Finance provider and plan are selected after capability, pricing, consent, and data-retention review.
- The exact initial historical import window supported by the selected provider.
- Whether shared spouse access uses one login, separate users with household membership, or another simple model.
- Whether the application stores minor units or database decimals, chosen consistently across domain and persistence.
- Whether pending transactions affect budget actuals, with the same policy applied consistently across screens.
- What exchange-rate source and valuation date are used if multi-currency rollups are introduced.
