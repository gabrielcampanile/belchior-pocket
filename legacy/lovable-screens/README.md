# Telas de referência do Lovable (fora do build)

Código herdado do protótipo Lovable, que era um gestor financeiro **manual**. Fica aqui só
como referência visual. **Não é compilado, não é lintado e não deve ser importado** por
nada em `src/`. Todas estas telas dependem de tabelas legadas que não existem no banco OPIN.

## Referência para a v1 (balanço mensal com Open Finance)

As telas novas reaproveitam o layout destas, mas leem direto do schema OPIN:

| Arquivo | Vira |
| --- | --- |
| `routes/index.tsx` | `src/routes/index.tsx`: mês atual, despesas por categoria e orçamento |
| `routes/transacoes.tsx` | `src/routes/transacoes.tsx`: extrato do Open Finance + CRUD manual |
| `routes/configuracoes.tsx` | categorias personalizáveis e orçamento fixo |

## Reservado para a v2

`planejamento.tsx`, `cenarios.tsx`, `patrimonio.tsx` (patrimônio/evolução), `fechamentos.tsx`,
`importar.tsx` (CSV), `onboarding.tsx` e os hooks `usePlanning.ts` / `useFinanceData.ts`.
Quando forem retomados, serão reescritos sobre o schema OPIN, e não religados a estes arquivos.

Apague esta pasta quando a v1 estiver completa e a v2 tiver o próprio design.
