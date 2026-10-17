import { useMemo, useState } from "react";
import { format } from "date-fns";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryBudgetEditor } from "@/components/finance/CategoryBudgetEditor";
import { CategoryDonut } from "@/components/finance/CategoryDonut";
import { CategoryShareList } from "@/components/finance/CategoryShareList";
import { EmptyState, PageHeader, Panel } from "@/components/finance/primitives";
import { Button } from "@/components/ui/button";
import {
  budgetProgress,
  monthCashflow,
  monthElapsedRatio,
  type BudgetRow,
  type BudgetStatus,
} from "@/domain/cashflow";
import { createConverter } from "@/domain/exchange";
import { useCashflowTransactions, useCategories } from "@/hooks/useCashflow";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCents, formatCentsShort, formatPercent } from "@/lib/format";
import { currentMonthKey, monthLabel } from "@/lib/months";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mês atual · Belchior" },
      {
        name: "description",
        content: "Receitas, despesas por categoria e orçamento do mês, a partir do Open Finance.",
      },
    ],
  }),
  component: CurrentMonthPage,
});

const STATUS_BAR: Record<BudgetStatus, string> = {
  ok: "bg-positive",
  warning: "bg-amber-500",
  over: "bg-negative",
  none: "bg-muted-foreground/40",
};

const STATUS_TEXT: Record<BudgetStatus, string> = {
  ok: "text-muted-foreground",
  warning: "text-amber-500",
  over: "text-negative",
  none: "text-muted-foreground",
};

function CurrentMonthPage() {
  const month = currentMonthKey();
  // Local date (not UTC): at 21h in Brazil the UTC date is already tomorrow.
  const today = format(new Date(), "yyyy-MM-dd");
  const [editing, setEditing] = useState(false);
  const [shareKind, setShareKind] = useState<"expense" | "income">("expense");
  const { displayCurrency, convert, rates } = useCurrency();
  const categoriesQuery = useCategories();
  const transactionsQuery = useCashflowTransactions(month);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const flow = useMemo(
    () => monthCashflow(transactions, categories, convert),
    [transactions, categories, convert],
  );
  // Budgets are stored in BRL: compare them against BRL totals, whatever the display currency.
  const budget = useMemo(() => {
    const toBrl = createConverter("BRL", rates);
    return budgetProgress(monthCashflow(transactions, categories, toBrl), categories);
  }, [transactions, categories, rates]);

  const elapsed = monthElapsedRatio(month, today);
  const day = Number(today.slice(8, 10));
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const loading = categoriesQuery.isLoading || transactionsQuery.isLoading;
  const error = categoriesQuery.error ?? transactionsQuery.error;
  const fmt = (cents: number) => formatCents(cents, displayCurrency);
  const withBudget = budget.rows.filter((r) => r.budgetCents != null);
  const withoutBudget = budget.rows.filter((r) => r.budgetCents == null && r.spentCents > 0);
  const shareRows = shareKind === "expense" ? flow.expense : flow.income;

  return (
    <AppLayout>
      <PageHeader
        title="Mês atual"
        description={`${capitalize(monthLabel(month))} · dia ${day} de ${daysInMonth}`}
        action={
          <Button variant="outline" onClick={() => setEditing(true)} className="h-10">
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
            Categorias e orçamento
          </Button>
        }
      />

      {error ? (
        <EmptyState
          title="Não foi possível carregar o mês"
          description={error instanceof Error ? error.message : "Tente novamente."}
        />
      ) : null}

      {/* Hero: the month's balance first, income and expense side by side below it. */}
      <Panel className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Saldo do mês
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl",
              flow.balanceCents >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {loading ? "…" : fmt(flow.balanceCents)}
          </p>
          {flow.incomeCents > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sobrou {formatPercent(flow.balanceCents / flow.incomeCents, 0)} da receita
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border pt-3">
          <div className="min-w-0 pr-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Receitas
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-positive">
              {loading ? "…" : fmt(flow.incomeCents)}
            </p>
          </div>
          <div className="min-w-0 pl-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Despesas
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
              {loading ? "…" : fmt(flow.expenseCents)}
            </p>
            {budget.ratio != null ? (
              <p className={cn("truncate text-[11px]", STATUS_TEXT[budget.status])}>
                {formatPercent(budget.ratio, 0)} do orçamento
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Transferências entre contas suas, fatura do cartão e aportes não contam.
        </p>
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Orçamento</h2>
          {budget.totalBudgetCents != null ? (
            <p className="text-xs text-muted-foreground">
              ritmo de hoje: {formatPercent(elapsed, 0)}
            </p>
          ) : null}
        </div>
        {budget.totalBudgetCents == null ? (
          <EmptyState
            title="Nenhum orçamento definido"
            description="O orçamento é um valor fixo por mês para cada categoria de despesa."
            action={<Button onClick={() => setEditing(true)}>Definir orçamento</Button>}
          />
        ) : (
          <>
            <BudgetBar
              label="Total"
              spentCents={budget.totalSpentCents}
              budgetCents={budget.totalBudgetCents}
              ratio={budget.ratio}
              status={budget.status}
              pace={elapsed}
              emphasis
            />
            <ul className="space-y-3.5 border-t border-border pt-4">
              {withBudget.map((row) => (
                <li key={row.categoryId ?? "none"}>
                  <BudgetRowView row={row} pace={elapsed} />
                </li>
              ))}
            </ul>
            {withoutBudget.length > 0 ? (
              <details className="group border-t border-border pt-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
                  <span>Sem orçamento ({withoutBudget.length})</span>
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                </summary>
                <ul className="divide-y divide-border">
                  {withoutBudget.map((row) => (
                    <li
                      key={row.categoryId ?? "none"}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCents(row.spentCents, "BRL")}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              O traço na barra marca onde o gasto estaria hoje se fosse distribuído igualmente pelo
              mês. Valores em R$.
            </p>
          </>
        )}
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {shareKind === "expense" ? "Onde gastei" : "De onde veio"}
          </h2>
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Tipo"
          >
            {(
              [
                { id: "expense", label: "Despesas" },
                { id: "income", label: "Receitas" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={shareKind === opt.id}
                onClick={() => setShareKind(opt.id)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                  shareKind === opt.id ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <CategoryDonut
            compact
            slices={shareRows.map((r) => ({
              categoryId: r.categoryId,
              name: r.name,
              total: r.totalCents,
            }))}
            currency={displayCurrency}
            emptyLabel={
              shareKind === "expense" ? "Nenhuma despesa neste mês" : "Nenhuma receita neste mês"
            }
          />
          <CategoryShareList rows={shareRows} currency={displayCurrency} />
        </div>
        <Button asChild variant="ghost" className="h-11 w-full justify-between">
          <Link to="/transacoes">
            Ver transações do mês
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </Panel>

      <CategoryBudgetEditor open={editing} onOpenChange={setEditing} categories={categories} />
    </AppLayout>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function BudgetRowView({ row, pace }: { row: BudgetRow; pace: number }) {
  return (
    <BudgetBar
      label={row.name}
      spentCents={row.spentCents}
      budgetCents={row.budgetCents ?? 0}
      ratio={row.ratio}
      status={row.status}
      pace={pace}
    />
  );
}

/**
 * Two short lines instead of one long one, so nothing wraps on a phone:
 * name + % on top, the bar, then "spent of budget" and what is left.
 */
function BudgetBar({
  label,
  spentCents,
  budgetCents,
  ratio,
  status,
  pace,
  emphasis = false,
}: {
  label: string;
  spentCents: number;
  budgetCents: number;
  ratio: number | null;
  status: BudgetStatus;
  pace: number;
  emphasis?: boolean;
}) {
  const pct = Math.min(1, ratio ?? 0);
  const remaining = budgetCents - spentCents;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn("min-w-0 truncate", emphasis ? "font-semibold text-foreground" : "")}>
          {label}
        </span>
        <span className={cn("shrink-0 font-medium tabular-nums", STATUS_TEXT[status])}>
          {ratio != null ? formatPercent(ratio, 0) : "—"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: orçamento consumido`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((ratio ?? 0) * 100)}
        aria-valuetext={`${formatPercent(ratio ?? 0, 0)} do orçamento`}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-surface-2",
          emphasis ? "h-3" : "h-2",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", STATUS_BAR[status])}
          style={{ width: `${pct * 100}%` }}
        />
        {/* Where spending "should" be today if it were spread evenly over the month. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-foreground/50"
          style={{ left: `${Math.min(1, pace) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] tabular-nums text-muted-foreground">
        <span className="truncate">
          {formatCentsShort(spentCents, "BRL")} de {formatCentsShort(budgetCents, "BRL")}
        </span>
        <span className={cn("shrink-0", remaining < 0 && "text-negative")}>
          {remaining >= 0
            ? `restam ${formatCentsShort(remaining, "BRL")}`
            : `passou ${formatCentsShort(-remaining, "BRL")}`}
        </span>
      </div>
    </div>
  );
}
