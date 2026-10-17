import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryDonut, sliceColor } from "@/components/finance/CategoryDonut";
import { EmptyState, PageHeader, Panel, SectionHeader } from "@/components/finance/primitives";
import { Label } from "@/components/ui/label";
import {
  cashflowByMonth,
  monthCashflow,
  summarizePeriod,
  type CategoryTotal,
} from "@/domain/cashflow";
import type { CurrencyCode } from "@/domain/currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCashflowTransactions, useCategories } from "@/hooks/useCashflow";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCents, formatCentsShort, formatPercent } from "@/lib/format";
import { currentMonthKey, lastMonths, monthLabel, monthLabelShort } from "@/lib/months";
import { cn } from "@/lib/utils";

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
  { id: "3", label: "3m" },
  { id: "6", label: "6m" },
  { id: "12", label: "12m" },
  { id: "ytd", label: "Ano" },
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
  const isMobile = useIsMobile();
  const [preset, setPreset] = useState<Preset>("6");
  const [shareKind, setShareKind] = useState<"expense" | "income">("expense");
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
  // Totals strip: "R$ 141 mil" on a phone (three columns), the exact value from sm up.
  const strip = (cents: number) =>
    isMobile
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: displayCurrency,
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(cents / 100)
      : short(cents);
  const chart = points.map((p) => ({
    label: monthLabelShort(p.month) + (p.month === end ? "*" : ""),
    Receitas: p.incomeCents / 100,
    Despesas: p.expenseCents / 100,
    Saldo: p.balanceCents / 100,
  }));
  const loading = categoriesQuery.isLoading || txQuery.isLoading;
  const error = categoriesQuery.error ?? txQuery.error;
  const empty = !loading && transactions.length === 0;
  const shareRows = shareKind === "expense" ? period.expense : period.income;
  // Narrow screens: thinner Y axis, fewer ticks, so the bars get the width.
  const yWidth = isMobile ? 44 : 70;

  return (
    <AppLayout>
      <PageHeader
        title="Relatórios"
        description={`${capitalize(monthLabelShort(months[0]))} a ${monthLabelShort(end)} · * mês em andamento`}
      />

      <div
        className="grid grid-cols-4 rounded-lg border border-border p-0.5 sm:inline-grid sm:w-80"
        role="group"
        aria-label="Período"
      >
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={cn(
              "h-9 rounded-md text-sm font-medium transition-colors",
              preset === p.id ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

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

      {/* Totals: one compact strip, three columns even on a phone. */}
      <Panel className="grid grid-cols-3 divide-x divide-border p-0 sm:p-0">
        <Total
          label="Receitas"
          value={loading ? "…" : strip(summary.incomeCents)}
          hint={`${strip(summary.avgIncomeCents)}/mês`}
          tone="positive"
        />
        <Total
          label="Despesas"
          value={loading ? "…" : strip(summary.expenseCents)}
          hint={`${strip(summary.avgExpenseCents)}/mês`}
        />
        <Total
          label="Saldo"
          value={loading ? "…" : strip(summary.balanceCents)}
          hint={
            summary.incomeCents > 0
              ? `sobrou ${formatPercent(summary.balanceCents / summary.incomeCents, 0)}`
              : "—"
          }
          tone={summary.balanceCents >= 0 ? "positive" : "negative"}
        />
      </Panel>

      <Panel className="space-y-3">
        <SectionHeader title="Mês a mês" />
        <div className="flex gap-4 text-xs text-muted-foreground" aria-hidden="true">
          <LegendDot color="var(--chart-2)" label="Receitas" />
          <LegendDot color="var(--chart-1)" label="Despesas" />
          <LegendDot color="var(--foreground)" label="Saldo" line />
        </div>
        <div className="-mx-2 h-56 sm:mx-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
                interval={isMobile && chart.length > 6 ? 1 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={10}
                width={yWidth}
                tickCount={4}
                tickFormatter={(v: number) => compactAxis(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [fmt(Math.round(v * 100)), name]}
              />
              <Bar dataKey="Receitas" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke="var(--foreground)"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <MonthList points={points} end={end} currency={displayCurrency} />
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Por categoria</h2>
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
            slices={toSlices(shareRows)}
            currency={displayCurrency}
            emptyLabel={
              shareKind === "expense" ? "Nenhuma despesa no período" : "Nenhuma receita no período"
            }
          />
          <CategoryShareList rows={shareRows} months={months.length} currency={displayCurrency} />
        </div>
      </Panel>

      <Panel className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Uma categoria no tempo</h2>
          <div className="sm:w-56">
            <Label htmlFor="focus-category" className="sr-only">
              Categoria
            </Label>
            <select
              id="focus-category"
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground sm:h-9"
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
        </div>
        <div className="-mx-2 h-48 sm:mx-0 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={focusPoints.map((p) => ({
                label: monthLabelShort(p.month) + (p.month === end ? "*" : ""),
                Gasto: p.expenseCents / 100,
              }))}
              margin={{ left: 0, right: 4, top: 8, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
                interval={isMobile && focusPoints.length > 6 ? 1 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={10}
                width={yWidth}
                tickCount={4}
                tickFormatter={(v: number) => compactAxis(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [fmt(Math.round(v * 100)), "Gasto"]}
              />
              <Bar dataKey="Gasto" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
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

/** Axis ticks without currency noise: 12k, 1,2M. The tooltip carries the exact value. */
function compactAxis(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function toSlices(rows: CategoryTotal[]) {
  return rows.map((r) => ({ categoryId: r.categoryId, name: r.name, total: r.totalCents }));
}

function Total({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
      <p className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-base font-semibold tabular-nums sm:text-2xl",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      <p className="truncate text-[11px] tabular-nums text-muted-foreground">{hint}</p>
    </div>
  );
}

function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={line ? "h-0.5 w-3 rounded-full" : "h-2.5 w-2.5 rounded-sm"}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Category share as a list: color (matches the donut), name, bar, % and totals. */
function CategoryShareList({
  rows,
  months,
  currency,
}: {
  rows: CategoryTotal[];
  months: number;
  currency: CurrencyCode;
}) {
  const sorted = useMemo(
    () => rows.filter((r) => r.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents),
    [rows],
  );
  if (sorted.length === 0) return null;
  return (
    <ul className="divide-y divide-border" aria-label="Total e percentual por categoria">
      {sorted.map((r, i) => (
        <li key={r.categoryId ?? "none"} className="py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: sliceColor(i, sorted.length) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatPercent(r.share, 0)}
            </span>
            <span className="w-24 shrink-0 text-right font-medium tabular-nums">
              {formatCentsShort(r.totalCents, currency)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 pl-[18px]">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, r.share * 100)}%`,
                  background: sliceColor(i, sorted.length),
                }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              {formatCentsShort(Math.round(r.totalCents / months), currency)}/mês
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One row per month (newest first): month and balance, then income · expense · saved. */
function MonthList({
  points,
  end,
  currency,
}: {
  points: ReturnType<typeof cashflowByMonth>;
  end: string;
  currency: CurrencyCode;
}) {
  return (
    <ul className="divide-y divide-border border-t border-border" aria-label="Resumo por mês">
      {[...points].reverse().map((p) => (
        <li key={p.month} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium capitalize">
              {monthLabel(p.month)}
              {p.month === end ? (
                <span className="font-normal text-muted-foreground"> · parcial</span>
              ) : null}
            </p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              <span className="text-positive">+{formatCentsShort(p.incomeCents, currency)}</span>
              {" · "}-{formatCentsShort(p.expenseCents, currency)}
              {p.savingsRatio == null ? "" : ` · sobrou ${formatPercent(p.savingsRatio, 0)}`}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              p.balanceCents >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {formatCents(p.balanceCents, currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}
