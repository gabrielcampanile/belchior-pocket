import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader } from "@/components/finance/primitives";

// Placeholder da v1 — a tela real (receitas, despesas por categoria e orçamento do mês)
// é reconstruída sobre o Open Finance no passo 3, usando o design de
// legacy/lovable-screens/routes/index.tsx como referência.
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mês atual · Belchior" }] }),
  component: () => (
    <AppLayout>
      <PageHeader
        title="Mês atual"
        description="Receitas, despesas por categoria e orçamento do mês."
      />
      <EmptyState
        title="Em construção"
        description="Esta tela passa a ler os dados do Open Finance no próximo passo."
      />
    </AppLayout>
  ),
});
