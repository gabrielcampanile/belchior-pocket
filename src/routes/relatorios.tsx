import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader } from "@/components/finance/primitives";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Belchior" },
      {
        name: "description",
        content: "Relatórios mensais e anuais da sua vida financeira, prontos para exportação.",
      },
      { property: "og:title", content: "Relatórios · Belchior" },
      { property: "og:description", content: "Consolidados mensais e anuais das suas finanças." },
    ],
  }),
  component: () => (
    <AppLayout>
      <PageHeader
        title="Relatórios"
        description="Histórico de receitas e despesas por categoria nos últimos meses."
      />
      <EmptyState
        title="Em construção"
        description="Os gráficos por categoria entram depois da tela do mês atual."
      />
    </AppLayout>
  ),
});
