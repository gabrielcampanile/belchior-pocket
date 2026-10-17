import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Pencil,
  PiggyBank,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { RuleDialog, type RuleSeed } from "@/components/finance/RuleDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { EmptyState, PageHeader } from "@/components/finance/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useIsMobile } from "@/hooks/use-mobile";
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
import { currentMonthKey, monthLabel, shiftMonth } from "@/lib/months";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transacoes")({
  head: () => ({ meta: [{ title: "Transações · Belchior" }] }),
  component: TransacoesPage,
});

const selectClass =
  "h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

// Bottom sheet on the phone (thumb reach), side panel on desktop.
const bottomSheet =
  "max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5";

function TransacoesPage() {
  const thisMonth = currentMonthKey();
  const isMobile = useIsMobile();
  const sheetSide = isMobile ? "bottom" : "right";
  const [month, setMonth] = useState(thisMonth);
  const [yearView, setYearView] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [ruleSeed, setRuleSeed] = useState<RuleSeed | null>(null);
  const openRule = (seed: RuleSeed) => setRuleSeed(seed);

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
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const set = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  // Search lives in the toolbar; the badge counts only what is hidden inside the sheet.
  const activeFilters =
    (filters.accountId !== "all" ? 1 : 0) +
    (filters.categoryId !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.showHidden ? 1 : 0);
  const filtered = activeFilters > 0 || filters.search !== "";

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (tx: TransactionRow) => {
    setSelected(null);
    setEditing(tx);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Transações"
        action={
          <Button onClick={openNew} disabled={accounts.length === 0} className="hidden sm:flex">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Novo lançamento
          </Button>
        }
      />

      {/* Toolbar: period + search + filters, all in two compact rows. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <p
              className="min-w-0 truncate text-center text-sm font-medium capitalize sm:min-w-44"
              aria-live="polite"
            >
              {yearView ? `${shortMonth(from)} – ${shortMonth(month)}` : monthLabel(month)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= thisMonth}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          <div
            className="flex shrink-0 rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Período"
          >
            {[
              { label: "Mês", value: false },
              { label: "12 meses", value: true },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={yearView === opt.value}
                onClick={() => setYearView(opt.value)}
                className={cn(
                  "h-9 rounded-md px-3 text-xs font-medium transition-colors",
                  yearView === opt.value ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Buscar transações"
              placeholder="Buscar"
              className="h-11 pl-9"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
          <Button
            variant={activeFilters ? "secondary" : "outline"}
            className="h-11 shrink-0 gap-2"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros
            {activeFilters ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
          <p className="min-w-0 truncate">
            {rows.length} itens ·{" "}
            <span className="text-positive">
              +{formatCents(totals.incomeCents, displayCurrency)}
            </span>{" "}
            ·{" "}
            <span className="text-negative">
              -{formatCents(Math.abs(totals.expenseCents), displayCurrency)}
            </span>
          </p>
          {filtered ? (
            <button
              type="button"
              className="shrink-0 font-medium text-primary"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

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
        <div className="-mx-4 sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border sm:bg-card">
          {groups.map((group) => (
            <section key={group.day} aria-label={dayLabel(group.day)}>
              <h2 className="bg-muted/40 px-4 py-1.5 text-xs font-medium capitalize text-muted-foreground">
                {dayLabel(group.day)}
              </h2>
              <ul>
                {group.rows.map((tx) => (
                  <TransactionLine
                    key={tx.id}
                    tx={tx}
                    account={accountById.get(tx.accountId)}
                    category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                    onOpen={() => setSelected(tx)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Floating "new" button on the phone, above the tab bar. */}
      <Button
        size="icon"
        onClick={openNew}
        disabled={accounts.length === 0}
        aria-label="Novo lançamento"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-20 h-14 w-14 rounded-full shadow-lg sm:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Button>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side={sheetSide} className={cn(isMobile && bottomSheet)}>
          <SheetHeader className="text-left">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription className="sr-only">Filtrar a lista de transações</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-account">Conta</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="f-category">Categoria</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="f-type">Tipo</Label>
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
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={filters.showHidden}
                onChange={(e) => set({ showHidden: e.target.checked })}
              />
              Mostrar ocultas
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, search: f.search }))}
              >
                Limpar
              </Button>
              <Button className="h-11 flex-1" onClick={() => setFiltersOpen(false)}>
                Ver {rows.length} itens
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side={sheetSide} className={cn(isMobile && bottomSheet)}>
          {selected ? (
            <TransactionActions
              // Re-read the row from the list so a recategorization shows up immediately.
              tx={(list.data ?? []).find((t) => t.id === selected.id) ?? selected}
              account={accountById.get(selected.accountId)}
              categories={categories}
              onEdit={openEdit}
              onCreateRule={(seed) => {
                setSelected(null);
                openRule(seed);
              }}
              onDone={() => setSelected(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        accounts={accounts}
        categories={categories}
        onImportedEdited={(seed) =>
          toast.success("Transação salva.", {
            action: { label: "Aplicar às parecidas", onClick: () => openRule(seed) },
          })
        }
      />
      <RuleDialog
        open={ruleSeed !== null}
        onOpenChange={(open) => !open && setRuleSeed(null)}
        seed={ruleSeed}
        categories={categories}
      />
    </AppLayout>
  );
}

function accountLabel(a: AccountOption): string {
  return a.institution ? `${a.institution} · ${a.name}` : a.name;
}

/** Short account tag for the row's second line: "XP Cartão", "Wise CAD", "Carteira". */
function accountShort(a: AccountOption | undefined): string {
  if (!a) return "Conta";
  if (!a.institution) return a.name;
  if (a.kind === "CREDIT_CARD") return `${a.institution} Cartão`;
  return a.currency === "BRL" ? a.institution : `${a.institution} ${a.currency}`;
}

function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (x: Date) => x.toDateString() === d.toDateString();
  if (same(today)) return "Hoje";
  if (same(yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function shortMonth(key: string): string {
  const d = new Date(`${key}-15T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
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

function TypeIcon({ tx }: { tx: TransactionRow }) {
  const Icon =
    tx.type === "INCOME"
      ? ArrowDownLeft
      : tx.type === "TRANSFER"
        ? ArrowLeftRight
        : tx.type === "CARD_PAYMENT"
          ? CreditCard
          : tx.type === "INVESTMENT_CONTRIBUTION"
            ? PiggyBank
            : ShoppingBag;
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full",
        tx.type === "INCOME" ? "bg-positive/15 text-positive" : "bg-muted text-muted-foreground",
      )}
      aria-hidden="true"
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

/** One line per transaction, bank-app style: icon · description/meta · amount. */
function TransactionLine({
  tx,
  account,
  category,
  onOpen,
}: {
  tx: TransactionRow;
  account: AccountOption | undefined;
  category: CashflowCategory | undefined;
  onOpen: () => void;
}) {
  const counts = tx.type === "INCOME" || tx.type === "EXPENSE";
  const refund = tx.type === "EXPENSE" && tx.amountCents > 0;
  const meta = [
    counts ? (category?.name ?? "Sem categoria") : TX_TYPE_LABEL[tx.type as TxType],
    accountShort(account),
    refund ? "Estorno" : null,
    tx.source === "MANUAL" ? "Manual" : null,
  ].filter(Boolean);

  return (
    <li className={cn(tx.hidden && "opacity-50")}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60 sm:hover:bg-muted/40"
      >
        <TypeIcon tx={tx} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {tx.description || "—"}
          </span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {tx.status === "PENDING" ? (
              <Clock className="h-3 w-3 shrink-0" aria-label="Pendente" />
            ) : null}
            {tx.hidden ? <EyeOff className="h-3 w-3 shrink-0" aria-label="Oculta" /> : null}
            <span className="truncate">{meta.join(" · ")}</span>
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            !counts
              ? "text-muted-foreground"
              : tx.amountCents >= 0
                ? "text-positive"
                : "text-foreground",
          )}
        >
          {formatCents(tx.amountCents, tx.currency)}
        </span>
      </button>
    </li>
  );
}

/** Everything you can do with one transaction, in the sheet opened by tapping its line. */
function TransactionActions({
  tx,
  account,
  categories,
  onEdit,
  onCreateRule,
  onDone,
}: {
  tx: TransactionRow;
  account: AccountOption | undefined;
  categories: CashflowCategory[];
  onEdit: (tx: TransactionRow) => void;
  onCreateRule: (seed: RuleSeed) => void;
  onDone: () => void;
}) {
  const setCategory = useSetCategory();
  const setHidden = useSetHidden();
  const remove = useDeleteManualTransaction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = categoryKindForType(tx.type);
  const counts = tx.type === "INCOME" || tx.type === "EXPENSE";
  const tags = [
    tx.status === "PENDING" ? "Pendente" : null,
    tx.source === "MANUAL" ? "Manual" : "Open Finance",
    tx.userOverridden ? "Editada" : null,
    tx.hidden ? "Oculta" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-1 pr-6 text-left">
        <SheetTitle className="break-words text-base">{tx.description || "—"}</SheetTitle>
        <SheetDescription>
          {new Date(`${tx.occurredOn}T12:00:00`).toLocaleDateString("pt-BR")} ·{" "}
          {account ? accountLabel(account) : "Conta"}
        </SheetDescription>
      </SheetHeader>

      <div>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            !counts ? "text-muted-foreground" : tx.amountCents >= 0 ? "text-positive" : "",
          )}
        >
          {formatCents(tx.amountCents, tx.currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {TX_TYPE_LABEL[tx.type as TxType] ?? tx.type} · {tags.join(" · ")}
        </p>
        {tx.notes ? <p className="mt-2 text-sm italic text-muted-foreground">{tx.notes}</p> : null}
      </div>

      {kind ? (
        <div className="space-y-1.5">
          <Label htmlFor="sheet-category">Categoria</Label>
          <select
            id="sheet-category"
            className={selectClass}
            value={tx.categoryId ?? ""}
            disabled={setCategory.isPending}
            onChange={(e) => {
              const next = e.target.value || null;
              setCategory.mutate(
                { id: tx.id, source: tx.source, categoryId: next },
                {
                  onSuccess: () => {
                    // The fix is for this row; offer to make it the rule for all similar ones.
                    if (tx.source === "IMPORT" && next) {
                      toast.success("Categoria salva.", {
                        action: {
                          label: "Aplicar às parecidas",
                          onClick: () => onCreateRule({ ...tx, categoryId: next }),
                        },
                      });
                    }
                  },
                },
              );
            }}
          >
            <option value="">Sem categoria</option>
            <CategoryOptions categories={categories} kind={kind} />
          </select>
        </div>
      ) : null}

      <div className="grid gap-2">
        <ActionButton icon={Pencil} label="Editar" onClick={() => onEdit(tx)} />
        {tx.source === "IMPORT" ? (
          <ActionButton
            icon={WandSparkles}
            label="Criar regra para as parecidas"
            onClick={() => onCreateRule(tx)}
          />
        ) : null}
        <ActionButton
          icon={tx.hidden ? Eye : EyeOff}
          label={tx.hidden ? "Mostrar nos totais" : "Ocultar dos totais"}
          disabled={setHidden.isPending}
          onClick={() => setHidden.mutate({ id: tx.id, hidden: !tx.hidden }, { onSuccess: onDone })}
        />
        {tx.source === "MANUAL" ? (
          confirmDelete ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" className="h-11" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="h-11"
                disabled={remove.isPending}
                onClick={() => remove.mutate(tx.id, { onSuccess: onDone })}
              >
                Apagar de vez
              </Button>
            </div>
          ) : (
            <ActionButton
              icon={Trash2}
              label="Apagar lançamento"
              destructive
              onClick={() => setConfirmDelete(true)}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="outline"
      className={cn("h-11 justify-start gap-3", destructive && "text-negative")}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
