import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader } from "@/components/finance/primitives";

// Placeholder da v1 — status das conexões Pluggy (XP, Wise) e "sincronizar agora" (passo 2).
export const Route = createFileRoute("/conexoes")({
  head: () => ({ meta: [{ title: "Conexões · Belchior" }] }),
  component: () => (
    <AppLayout>
      <PageHeader
        title="Conexões"
        description="Instituições conectadas via Open Finance e status da sincronização."
      />
      <EmptyState
        title="Em construção"
        description="A sincronização com o Pluggy entra no próximo passo."
      />
    </AppLayout>
  ),
});
