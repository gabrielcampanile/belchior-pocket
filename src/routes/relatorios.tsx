import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryDonut } from "@/components/finance/CategoryDonut";
import {
  EmptyState,
  MetricValue,
  PageHeader,
  Panel,
  SectionHeader,
} from "@/components/finance/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  cashflowByMonth,
  monthCashflow,
  summarizePeriod,
  type CategoryTotal,
} from "@/domain/cashflow";
import type { CurrencyCode } from "@/domain/currency";
import { useCashflowTransactions, useCategories } from "@/hooks/useCashflow";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCents, formatCentsShort, formatPercent } from "@/lib/format";
import { currentMonthKey, lastMonths, monthLabel, monthLabelShort } from "@/lib/months";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Belchior" },
      {
        name: "description",
        content: "Histórico de receitas e despesas por mês e por categoria.",
      },
    ],
  }),
  component: RelatoriosPage,
});

type Preset = "3" | "6" | "12" | "ytd";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "3", label: "3 meses" },
  { id: "6", label: "6 meses" },
  { id: "12", label: "12 meses" },
  { id: "ytd", label: "Este ano" },
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function presetMonths(preset: Preset, end: string): string[] {
  if (preset === "ytd") return lastMonths(end, Number(end.slice(5, 7)));
  return lastMonths(end, Number(preset));
}

function RelatoriosPage() {
  const end = currentMonthKey();
  const [preset, setPreset] = useState<Preset>("6");
  const [focusCategory, setFocusCategory] = useState("");
  const months = useMemo(() => presetMonths(preset, end), [preset, end]);
  const { convert, displayCurrency } = useCurrency();
  const categoriesQuery = useCategories();
  const txQuery = useCashflowTransactions(months[0], end);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);

  const points = useMemo(
    () => cashflowByMonth(transactions, months, categories, convert),
    [transactions, months, categories, convert],
  );
  const summary = useMemo(() => summarizePeriod(points), [points]);
  const period = useMemo(
    () => monthCashflow(transactions, categories, convert),
    [transactions, categories, convert],
  );
  const expenseCategories = categories.filter((c) => c.kind === "EXPENSE");
  const focusId = focusCategory || period.expense.find((r) => r.categoryId)?.categoryId || "";
  const focusPoints = useMemo(
    () =>
      cashflowByMonth(
        transactions.filter((t) => t.type === "EXPENSE" && t.categoryId === focusId),
        months,
        categories,
        convert,
      ),
    [transactions, focusId, months, categories, convert],
  );

  const fmt = (cents: number) => formatCents(cents, displayCurrency);
  const short = (cents: number) => formatCentsShort(cents, displayCurrency);
  const chart = points.map((p) => ({
    label: monthLabelShort(p.month) + (p.month === end ? "*" : ""),
    Receitas: p.incomeCents / 100,
    Despesas: p.expenseCents / 100,
    Saldo: p.balanceCents / 100,
  }));
  const loading = categoriesQuery.isLoading || txQuery.isLoading;
  const error = categoriesQuery.error ?? txQuery.error;
  const empty = !loading && transactions.length === 0;

  return (
    <AppLayout>
      <PageHeader
        title="Relatórios"
        description={`${capitalize(monthLabel(months[0]))} a ${monthLabel(end)} · o mês atual (*) ainda está em andamento.`}
        action={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? "secondary" : "outline"}
                aria-pressed={preset === p.id}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      {error ? (
        <EmptyState
          title="Não foi possível carregar o relatório"
          description={error instanceof Error ? error.message : "Tente novamente."}
        />
      ) : null}
      {empty ? (
        <EmptyState
          title="Sem transações no período"
          description="Sincronize em Conexões ou escolha um período maior."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricValue
          label="Receitas"
          value={loading ? "…" : fmt(summary.incomeCents)}
          hint={`Média ${fmt(summary.avgIncomeCents)}/mês`}
          badge="REAL"
        />
        <MetricValue
          label="Despesas"
          value={loading ? "…" : fmt(summary.expenseCents)}
          hint={`Média ${fmt(summary.avgExpenseCents)}/mês`}
          badge="REAL"
        />
        <MetricValue
          label="Saldo do período"
          value={loading ? "…" : fmt(summary.balanceCents)}
          tone={summary.balanceCents >= 0 ? "positive" : "negative"}
          hint={
            summary.incomeCents > 0
              ? `Sobrou ${formatPercent(summary.balanceCents / summary.incomeCents, 0)} da receita`
              : undefined
          }
          badge="REAL"
        />
      </div>

      <Panel className="space-y-4">
        <SectionHeader
          title="Receitas e despesas por mês"
          description="Barras: receitas e despesas. Linha: saldo do mês."
        />
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
                width={70}
                tickFormatter={(v: number) => short(v * 100)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [fmt(Math.round(v * 100)), name]}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar dataKey="Receitas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke="var(--foreground)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <MonthTable points={points} end={end} currency={displayCurrency} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-4">
          <SectionHeader
            title="Despesas por categoria"
            description="Quanto cada categoria pesou no período."
          />
          <CategoryDonut
            slices={toSlices(period.expense)}
            currency={displayCurrency}
            emptyLabel="Nenhuma despesa no período"
          />
          <CategoryShareList
            rows={period.expense}
            months={months.length}
            currency={displayCurrency}
          />
        </Panel>
        <Panel className="space-y-4">
          <SectionHeader
            title="Receitas por categoria"
            description="De onde veio o dinheiro no período."
          />
          <CategoryDonut
            slices={toSlices(period.income)}
            currency={displayCurrency}
            emptyLabel="Nenhuma receita no período"
          />
          <CategoryShareList
            rows={period.income}
            months={months.length}
            currency={displayCurrency}
          />
        </Panel>
      </div>

      <Panel className="space-y-4">
        <SectionHeader
          title="Uma categoria ao longo do tempo"
          description="Gasto mês a mês de uma categoria de despesa."
          action={
            <div className="w-56">
              <Label htmlFor="focus-category" className="sr-only">
                Categoria
              </Label>
              <select
                id="focus-category"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={focusId}
                onChange={(e) => setFocusCategory(e.target.value)}
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={focusPoints.map((p) => ({
                label: monthLabelShort(p.month) + (p.month === end ? "*" : ""),
                Gasto: p.expenseCents / 100,
              }))}
              margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
                width={70}
                tickFormatter={(v: number) => short(v * 100)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [fmt(Math.round(v * 100)), "Gasto"]}
              />
              <Bar dataKey="Gasto" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </AppLayout>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toSlices(rows: CategoryTotal[]) {
  return rows.map((r) => ({ categoryId: r.categoryId, name: r.name, total: r.totalCents }));
}

function CategoryShareList({
  rows,
  months,
  currency,
}: {
  rows: CategoryTotal[];
  months: number;
  currency: CurrencyCode;
}) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Total, percentual e média mensal por categoria</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-2 text-left font-medium">
            Categoria
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            %
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Média/mês
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Total
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.categoryId ?? "none"}>
            <th scope="row" className="max-w-0 truncate py-2 text-left font-normal text-foreground">
              {r.name}
            </th>
            <td className="py-2 text-right tabular-nums text-muted-foreground">
              {formatPercent(r.share, 0)}
            </td>
            <td className="py-2 text-right tabular-nums text-muted-foreground">
              {formatCents(Math.round(r.totalCents / months), currency)}
            </td>
            <td className="py-2 text-right tabular-nums text-foreground">
              {formatCents(r.totalCents, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthTable({
  points,
  end,
  currency,
}: {
  points: ReturnType<typeof cashflowByMonth>;
  end: string;
  currency: CurrencyCode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Receitas, despesas e saldo por mês</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="py-2 text-left font-medium">
              Mês
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Receitas
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Despesas
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Saldo
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Sobrou
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...points].reverse().map((p) => (
            <tr key={p.month}>
              <th scope="row" className="py-2 text-left font-normal capitalize text-foreground">
                {monthLabel(p.month)}
                {p.month === end ? " (parcial)" : ""}
              </th>
              <td className="py-2 text-right tabular-nums">
                {formatCents(p.incomeCents, currency)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCents(p.expenseCents, currency)}
              </td>
              <td
                className={
                  p.balanceCents >= 0
                    ? "py-2 text-right tabular-nums text-positive"
                    : "py-2 text-right tabular-nums text-negative"
                }
              >
                {formatCents(p.balanceCents, currency)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {p.savingsRatio == null ? "—" : formatPercent(p.savingsRatio, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
