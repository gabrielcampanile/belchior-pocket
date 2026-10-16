import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { EmptyState, PageHeader, Panel } from "@/components/finance/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { monthCashflow, type CashflowCategory } from "@/domain/cashflow";
import {
  categoryKindForType,
  DEFAULT_FILTERS,
  filterTransactions,
  groupByDay,
  NO_CATEGORY,
  TX_TYPE_LABEL,
  TX_TYPES,
  type TransactionFilters,
  type TxType,
} from "@/domain/transactions";
import { useCategories } from "@/hooks/useCashflow";
import { useCurrency } from "@/hooks/useCurrency";
import {
  useAccountOptions,
  useDeleteManualTransaction,
  useSetCategory,
  useSetHidden,
  useTransactionList,
  type AccountOption,
  type TransactionRow,
} from "@/hooks/useTransactions";
import { formatCents } from "@/lib/format";
import { currentMonthKey, formatDateBR, monthLabel, shiftMonth } from "@/lib/months";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transacoes")({
  head: () => ({ meta: [{ title: "Transações · Belchior" }] }),
  component: TransacoesPage,
});

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

function TransacoesPage() {
  const thisMonth = currentMonthKey();
  const [month, setMonth] = useState(thisMonth);
  const [yearView, setYearView] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const from = yearView ? shiftMonth(month, -11) : month;
  const list = useTransactionList(from, month);
  const accountsQuery = useAccountOptions();
  const categoriesQuery = useCategories();
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const { convert, displayCurrency } = useCurrency();

  const rows = useMemo(() => filterTransactions(list.data ?? [], filters), [list.data, filters]);
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const totals = useMemo(
    () => monthCashflow(rows, categories, convert),
    [rows, categories, convert],
  );
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const set = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered =
    filters.search ||
    filters.accountId !== "all" ||
    filters.categoryId !== "all" ||
    filters.type !== "all" ||
    filters.showHidden;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Transações"
        description="Extrato do Open Finance e lançamentos manuais. Corrija a categoria quando o banco errar."
        action={
          <Button onClick={openNew} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Novo lançamento
          </Button>
        }
      />

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="min-w-44 text-center text-sm font-medium capitalize" aria-live="polite">
              {yearView ? `${monthLabel(from)} – ${monthLabel(month)}` : monthLabel(month)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= thisMonth}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={yearView ? "outline" : "secondary"}
              onClick={() => setYearView(false)}
              aria-pressed={!yearView}
            >
              Mês
            </Button>
            <Button
              size="sm"
              variant={yearView ? "secondary" : "outline"}
              onClick={() => setYearView(true)}
              aria-pressed={yearView}
            >
              12 meses
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="f-search" className="text-xs text-muted-foreground">
              Buscar
            </Label>
            <Input
              id="f-search"
              type="search"
              placeholder="Descrição ou nota"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-account" className="text-xs text-muted-foreground">
              Conta
            </Label>
            <select
              id="f-account"
              className={selectClass}
              value={filters.accountId}
              onChange={(e) => set({ accountId: e.target.value })}
            >
              <option value="all">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-category" className="text-xs text-muted-foreground">
              Categoria
            </Label>
            <select
              id="f-category"
              className={selectClass}
              value={filters.categoryId}
              onChange={(e) => set({ categoryId: e.target.value })}
            >
              <option value="all">Todas</option>
              <option value={NO_CATEGORY}>Sem categoria</option>
              <CategoryOptions categories={categories} />
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-type" className="text-xs text-muted-foreground">
              Tipo
            </Label>
            <select
              id="f-type"
              className={selectClass}
              value={filters.type}
              onChange={(e) => set({ type: e.target.value as TransactionFilters["type"] })}
            >
              <option value="all">Todos</option>
              {TX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TX_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={filters.showHidden}
              onChange={(e) => set({ showHidden: e.target.checked })}
            />
            Mostrar ocultas
          </label>
          <p className="tabular-nums text-muted-foreground">
            {rows.length} transações · receitas{" "}
            <span className="text-positive">
              {formatCents(totals.incomeCents, displayCurrency)}
            </span>{" "}
            · despesas{" "}
            <span className="text-negative">
              {formatCents(totals.expenseCents, displayCurrency)}
            </span>
            {filtered ? (
              <Button variant="link" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpar filtros
              </Button>
            ) : null}
          </p>
        </div>
      </Panel>

      {list.error ? (
        <EmptyState
          title="Não foi possível carregar as transações"
          description={list.error instanceof Error ? list.error.message : "Tente novamente."}
        />
      ) : list.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          title={filtered ? "Nada encontrado com esses filtros" : "Nenhuma transação no período"}
          description={
            filtered
              ? "Ajuste os filtros ou limpe para ver tudo."
              : "Sincronize em Conexões ou crie um lançamento manual."
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Panel key={group.day} className="p-0">
              <h2 className="border-b border-border px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {formatDateBR(group.day)}
              </h2>
              <ul className="divide-y divide-border">
                {group.rows.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    account={accountById.get(tx.accountId)}
                    categories={categories}
                    onEdit={() => {
                      setEditing(tx);
                      setDialogOpen(true);
                    }}
                  />
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        accounts={accounts}
        categories={categories}
      />
    </AppLayout>
  );
}

function accountLabel(a: AccountOption): string {
  return a.institution ? `${a.institution} · ${a.name}` : a.name;
}

function CategoryOptions({
  categories,
  kind,
}: {
  categories: CashflowCategory[];
  kind?: "INCOME" | "EXPENSE";
}) {
  const groups = (["EXPENSE", "INCOME"] as const).filter((k) => !kind || k === kind);
  return (
    <>
      {groups.map((k) => (
        <optgroup key={k} label={k === "EXPENSE" ? "Despesas" : "Receitas"}>
          {categories
            .filter((c) => c.kind === k)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function TransactionItem({
  tx,
  account,
  categories,
  onEdit,
}: {
  tx: TransactionRow;
  account: AccountOption | undefined;
  categories: CashflowCategory[];
  onEdit: () => void;
}) {
  const setCategory = useSetCategory();
  const setHidden = useSetHidden();
  const remove = useDeleteManualTransaction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = categoryKindForType(tx.type);
  const refund = tx.type === "EXPENSE" && tx.amountCents > 0;
  const counts = tx.type === "INCOME" || tx.type === "EXPENSE";
  const categoryId = `cat-${tx.id}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3",
        tx.hidden && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{tx.description || "—"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{account ? accountLabel(account) : "Conta"}</span>
          {!counts ? (
            <Badge variant="outline">{TX_TYPE_LABEL[tx.type as TxType] ?? tx.type}</Badge>
          ) : null}
          {tx.status === "PENDING" ? <Badge variant="outline">Pendente</Badge> : null}
          {tx.source === "MANUAL" ? <Badge variant="outline">Manual</Badge> : null}
          {tx.userOverridden ? <Badge variant="outline">Editada</Badge> : null}
          {refund ? <Badge variant="outline">Estorno</Badge> : null}
          {tx.hidden ? <Badge variant="outline">Oculta</Badge> : null}
          {tx.notes ? <span className="truncate italic">{tx.notes}</span> : null}
        </div>
      </div>

      {kind ? (
        <div className="w-44">
          <label htmlFor={categoryId} className="sr-only">
            Categoria de {tx.description}
          </label>
          <select
            id={categoryId}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            value={tx.categoryId ?? ""}
            disabled={setCategory.isPending}
            onChange={(e) =>
              setCategory.mutate({
                id: tx.id,
                source: tx.source,
                categoryId: e.target.value || null,
              })
            }
          >
            <option value="">Sem categoria</option>
            <CategoryOptions categories={categories} kind={kind} />
          </select>
        </div>
      ) : null}

      <p
        className={cn(
          "w-32 text-right text-sm tabular-nums",
          !counts
            ? "text-muted-foreground"
            : tx.amountCents >= 0
              ? "text-positive"
              : "text-foreground",
        )}
      >
        {formatCents(tx.amountCents, tx.currency)}
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label={`Editar ${tx.description}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={setHidden.isPending}
          onClick={() => setHidden.mutate({ id: tx.id, hidden: !tx.hidden })}
          aria-label={tx.hidden ? `Mostrar ${tx.description}` : `Ocultar ${tx.description}`}
        >
          {tx.hidden ? (
            <Eye className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        {tx.source === "MANUAL" ? (
          confirmDelete ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(tx.id)}
              >
                Apagar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Apagar ${tx.description}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}
