import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader } from "@/components/finance/primitives";

// Placeholder da v1 — extrato do Open Finance + CRUD manual (passo 4), com o design de
// legacy/lovable-screens/routes/transacoes.tsx como referência.
export const Route = createFileRoute("/transacoes")({
  head: () => ({ meta: [{ title: "Transações · Belchior" }] }),
  component: () => (
    <AppLayout>
      <PageHeader
        title="Transações"
        description="Extrato do Open Finance com edição, recategorização e lançamentos manuais."
      />
      <EmptyState
        title="Em construção"
        description="Esta tela passa a ler os dados do Open Finance em breve."
      />
    </AppLayout>
  ),
});
