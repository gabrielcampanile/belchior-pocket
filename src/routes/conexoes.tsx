import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Landmark, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader, Panel } from "@/components/finance/primitives";
import { ManualAccountsPanel } from "@/components/finance/ManualAccountsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toCurrencyCode } from "@/domain/currency";
import { formatCents } from "@/lib/format";
import { OPEN_FINANCE_QUERY_KEY, useSyncNow } from "@/hooks/useOpenFinanceSync";

export const Route = createFileRoute("/conexoes")({
  head: () => ({ meta: [{ title: "Conexões · Belchior" }] }),
  component: ConexoesPage,
});

type ConnectionStatus = Database["public"]["Enums"]["connection_status"];

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  ACTIVE: "Ativa",
  LOGIN_ERROR: "Reautenticar",
  OUTDATED: "Desatualizada",
  DISCONNECTED: "Desconectada",
};

const RUN_LABEL: Record<string, string> = {
  running: "Sincronizando…",
  success: "Sucesso",
  auth_error: "Erro de autenticação",
  transient_error: "Falha temporária",
  permanent_error: "Erro",
};

function useConnections() {
  return useQuery({
    queryKey: [...OPEN_FINANCE_QUERY_KEY, "connections"],
    queryFn: async () => {
      const [connections, accounts, runs] = await Promise.all([
        supabase
          .from("provider_connections")
          .select("id, institution_name, status, last_synced_at, last_error")
          .order("institution_name"),
        supabase
          .from("accounts")
          .select(
            "id, connection_id, name, kind, currency, balance_cents, credit_limit_cents, credit_due_day",
          )
          .eq("archived", false)
          .order("name"),
        supabase
          .from("sync_runs")
          .select("connection_id, status, started_at, finished_at, transactions_upserted, error")
          .order("started_at", { ascending: false })
          .limit(50),
      ]);
      for (const r of [connections, accounts, runs]) if (r.error) throw new Error(r.error.message);
      return {
        connections: connections.data ?? [],
        accounts: accounts.data ?? [],
        runs: runs.data ?? [],
      };
    },
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffMin < 60 * 24) return rtf.format(-Math.round(diffMin / 60), "hour");
  return rtf.format(-Math.round(diffMin / (60 * 24)), "day");
}

function ConexoesPage() {
  const { data, isLoading, error } = useConnections();
  const syncNow = useSyncNow();

  const syncButton = (
    <Button
      onClick={() => syncNow.mutate()}
      disabled={syncNow.isPending}
      className="h-11 flex-1 gap-2 sm:h-10 sm:flex-none"
    >
      <RefreshCw className={syncNow.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {syncNow.isPending ? "Sincronizando…" : "Sincronizar agora"}
    </Button>
  );

  return (
    <AppLayout>
      <PageHeader
        title="Conexões"
        description="Open Finance, sincronização e contas manuais."
        action={syncButton}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : error ? (
        <EmptyState title="Não foi possível carregar as conexões" description={error.message} />
      ) : !data || data.connections.length === 0 ? (
        <EmptyState
          title="Nenhuma conexão sincronizada ainda"
          description="Clique em “Sincronizar agora” para trazer as contas e transações do Pluggy."
          action={syncButton}
        />
      ) : (
        <div className="space-y-4">
          {data.connections.map((connection) => {
            const lastRun = data.runs.find((r) => r.connection_id === connection.id);
            const accounts = data.accounts.filter((a) => a.connection_id === connection.id);
            return (
              <Panel key={connection.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {connection.institution_name}
                    </h2>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      Sincronizado {formatRelative(connection.last_synced_at)}
                      {lastRun?.status === "success"
                        ? ` · ${lastRun.transactions_upserted} atualizadas`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {lastRun && lastRun.status !== "success" ? (
                      <Badge variant={lastRun.status === "running" ? "secondary" : "destructive"}>
                        {RUN_LABEL[lastRun.status] ?? lastRun.status}
                      </Badge>
                    ) : null}
                    <Badge variant={connection.status === "ACTIVE" ? "outline" : "destructive"}>
                      {STATUS_LABEL[connection.status]}
                    </Badge>
                  </div>
                </div>

                {connection.last_error ? (
                  <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {connection.last_error}
                  </p>
                ) : null}

                <ul className="divide-y divide-border">
                  {accounts.map((account) => {
                    const currency = toCurrencyCode(account.currency);
                    const isCard = account.kind === "CREDIT_CARD";
                    const Icon = isCard ? CreditCard : Landmark;
                    return (
                      <li key={account.id} className="flex items-center gap-3 py-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isCard
                              ? [
                                  account.credit_limit_cents != null
                                    ? `Limite ${formatCents(Number(account.credit_limit_cents), currency)}`
                                    : null,
                                  account.credit_due_day
                                    ? `vence dia ${account.credit_due_day}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Cartão de crédito"
                              : currency}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums text-foreground">
                            {formatCents(Number(account.balance_cents), currency)}
                          </p>
                          {isCard ? (
                            <p className="text-xs text-muted-foreground">fatura atual</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
          <p className="text-xs text-muted-foreground">
            O Pluggy atualiza os dados dos bancos por conta própria, cerca de uma vez por dia. O app
            sincroniza ao abrir (se a última sincronização tiver mais de 6 horas) e quando você
            clica em “Sincronizar agora”.
          </p>
        </div>
      )}

      <ManualAccountsPanel />
    </AppLayout>
  );
}
