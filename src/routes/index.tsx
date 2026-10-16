import { useMemo, useState } from "react";
import { format } from "date-fns";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryBudgetEditor } from "@/components/finance/CategoryBudgetEditor";
import { CategoryDonut } from "@/components/finance/CategoryDonut";
import {
  EmptyState,
  MetricValue,
  PageHeader,
  Panel,
  SectionHeader,
} from "@/components/finance/primitives";
import { Button } from "@/components/ui/button";
import {
  budgetProgress,
  monthCashflow,
  monthElapsedRatio,
  type BudgetRow,
  type BudgetStatus,
  type CategoryTotal,
} from "@/domain/cashflow";
import type { CurrencyCode } from "@/domain/currency";
import { createConverter } from "@/domain/exchange";
import { useCashflowTransactions, useCategories } from "@/hooks/useCashflow";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCents, formatPercent } from "@/lib/format";
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

  return (
    <AppLayout>
      <PageHeader
        title="Mês atual"
        description={`${capitalize(monthLabel(month))} · dia ${day} de ${daysInMonth}`}
        action={
          <Button variant="outline" onClick={() => setEditing(true)}>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricValue
          label="Receitas"
          value={loading ? "…" : fmt(flow.incomeCents)}
          hint="Transferências entre contas suas não contam"
          badge="REAL"
        />
        <MetricValue
          label="Despesas"
          value={loading ? "…" : fmt(flow.expenseCents)}
          hint={
            budget.ratio != null
              ? `${formatPercent(budget.ratio, 0)} do orçamento`
              : "Fatura do cartão e aportes não contam"
          }
          badge="REAL"
        />
        <MetricValue
          label="Saldo do mês"
          value={loading ? "…" : fmt(flow.balanceCents)}
          tone={flow.balanceCents >= 0 ? "positive" : "negative"}
          hint={
            flow.incomeCents > 0
              ? `Sobrou ${formatPercent(flow.balanceCents / flow.incomeCents, 0)} da receita`
              : undefined
          }
          badge="REAL"
        />
      </div>

      <Panel className="space-y-5">
        <SectionHeader
          title="Orçamento do mês"
          description={
            budget.totalBudgetCents == null
              ? "Defina um valor por categoria para acompanhar quanto já gastou."
              : `Ritmo esperado hoje: ${formatPercent(elapsed, 0)} do mês. Valores em R$.`
          }
        />
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
            <ul className="space-y-4">
              {budget.rows.map((row) => (
                <li key={row.categoryId ?? "none"}>
                  <BudgetRowView row={row} pace={elapsed} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-4">
          <SectionHeader
            title="Onde gastei"
            description="Despesas do mês por categoria."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/transacoes">Ver transações</Link>
              </Button>
            }
          />
          <CategoryDonut
            slices={flow.expense.map((r) => ({
              categoryId: r.categoryId,
              name: r.name,
              total: r.totalCents,
            }))}
            currency={displayCurrency}
            emptyLabel="Nenhuma despesa neste mês"
          />
          <CategoryList rows={flow.expense} currency={displayCurrency} />
        </Panel>
        <Panel className="space-y-4">
          <SectionHeader title="De onde veio" description="Receitas do mês por categoria." />
          {flow.income.length === 0 ? (
            <EmptyState
              title="Nenhuma receita neste mês"
              description="As entradas aparecem aqui assim que o banco as liberar no Open Finance."
            />
          ) : (
            <CategoryList rows={flow.income} currency={displayCurrency} />
          )}
        </Panel>
      </div>

      <CategoryBudgetEditor open={editing} onOpenChange={setEditing} categories={categories} />
    </AppLayout>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function CategoryList({ rows, currency }: { rows: CategoryTotal[]; currency: CurrencyCode }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.categoryId ?? "none"} className="flex items-center gap-4 py-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
            {formatPercent(row.share, 0)}
          </span>
          <span className="w-28 shrink-0 text-right tabular-nums text-foreground">
            {formatCents(row.totalCents, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BudgetRowView({ row, pace }: { row: BudgetRow; pace: number }) {
  if (row.budgetCents == null) {
    return (
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="min-w-0 truncate text-foreground">{row.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {formatCents(row.spentCents, "BRL")} · sem orçamento
        </span>
      </div>
    );
  }
  return (
    <BudgetBar
      label={row.name}
      spentCents={row.spentCents}
      budgetCents={row.budgetCents}
      ratio={row.ratio}
      status={row.status}
      pace={pace}
    />
  );
}

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
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className={cn("min-w-0 truncate", emphasis ? "font-semibold text-foreground" : "")}>
          {label}
        </span>
        <span className={cn("shrink-0 tabular-nums", STATUS_TEXT[status])}>
          {formatCents(spentCents, "BRL")} de {formatCents(budgetCents, "BRL")}
          {ratio != null ? ` · ${formatPercent(ratio, 0)}` : ""}
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
      {emphasis ? (
        <p className={cn("text-xs", remaining < 0 ? "text-negative" : "text-muted-foreground")}>
          {remaining >= 0
            ? `Restam ${formatCents(remaining, "BRL")} para o mês.`
            : `Passou ${formatCents(-remaining, "BRL")} do orçamento.`}
        </p>
      ) : null}
    </div>
  );
}
