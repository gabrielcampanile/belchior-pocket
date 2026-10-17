import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CashflowCategory } from "@/domain/cashflow";
import {
  categoryKindForType,
  MANUAL_TX_TYPES,
  signedAmountForType,
  TX_TYPE_LABEL,
  TX_TYPES,
  type TxType,
} from "@/domain/transactions";
import {
  useCreateTransaction,
  useUpdateTransaction,
  type AccountOption,
  type TransactionRow,
} from "@/hooks/useTransactions";
import { centsToInput, parseCurrencyToCents } from "@/lib/format";
import type { RuleSeed } from "@/components/finance/RuleDialog";

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

/**
 * Create a manual entry (editing = null) or edit an existing row. Open Finance rows keep
 * the bank's account, date and amount; their description, type, category and notes can be
 * changed, and the sync will no longer overwrite them.
 */
export function TransactionDialog({
  open,
  onOpenChange,
  editing,
  accounts,
  categories,
  onImportedEdited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TransactionRow | null;
  accounts: AccountOption[];
  categories: CashflowCategory[];
  /** An Open Finance row changed type or category: the page offers a rule for similar ones. */
  onImportedEdited?: (seed: RuleSeed) => void;
}) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const imported = editing?.source === "IMPORT";

  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [type, setType] = useState<TxType>("EXPENSE");
  const [refund, setRefund] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(editing?.accountId ?? accounts[0]?.id ?? "");
    setDescription(editing?.description ?? "");
    setAmount(editing ? centsToInput(Math.abs(editing.amountCents), editing.currency) : "");
    setOccurredOn(editing?.occurredOn ?? format(new Date(), "yyyy-MM-dd"));
    setType((editing?.type as TxType) ?? "EXPENSE");
    setRefund(editing?.type === "EXPENSE" && editing.amountCents > 0);
    setCategoryId(editing?.categoryId ?? "");
    setNotes(editing?.notes ?? "");
  }, [open, editing, accounts]);

  const kind = categoryKindForType(type);
  const options = kind ? categories.filter((c) => c.kind === kind) : [];
  const account = accounts.find((a) => a.id === accountId);
  const magnitude = parseCurrencyToCents(amount, account?.currency ?? editing?.currency);
  const valid =
    description.trim().length > 0 &&
    magnitude != null &&
    magnitude > 0 &&
    !!account &&
    /^\d{4}-\d{2}-\d{2}$/.test(occurredOn);
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || magnitude == null || !account) return;
    const input = {
      accountId,
      description,
      notes: notes || null,
      amountCents: signedAmountForType(type, magnitude, editing?.amountCents, {
        refund: type === "EXPENSE" && refund,
      }),
      occurredOn,
      type,
      categoryId: categoryId || null,
    };
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      const reclassified =
        editing.source === "IMPORT" &&
        (input.type !== editing.type || input.categoryId !== editing.categoryId);
      update.mutate(
        { id: editing.id, source: editing.source, input },
        {
          onSuccess: () => {
            onOpenChange(false);
            if (reclassified) {
              onImportedEdited?.({
                description: input.description,
                amountCents: input.amountCents,
                type: input.type,
                categoryId: input.categoryId,
              });
            }
          },
        },
      );
    } else create.mutate({ ...input, currency: account.currency }, done);
  };

  const typeChoices =
    imported || (editing && !MANUAL_TX_TYPES.includes(type)) ? TX_TYPES : MANUAL_TX_TYPES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar transação" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>
              {imported
                ? "Veio do Open Finance: conta, data e valor seguem o banco. O que você mudar aqui não é sobrescrito pela sincronização."
                : "Lançamento manual, somado junto com os dados do Open Finance."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Descrição</Label>
            <Input
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tx-type">Tipo</Label>
              <select
                id="tx-type"
                className={selectClass}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as TxType);
                  setCategoryId("");
                }}
              >
                {typeChoices.map((t) => (
                  <option key={t} value={t}>
                    {TX_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Categoria</Label>
              <select
                id="tx-category"
                className={selectClass}
                value={categoryId}
                disabled={!kind}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">{kind ? "Sem categoria" : "Não se aplica"}</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {type !== "INCOME" && type !== "EXPENSE" ? (
            <p className="text-xs text-muted-foreground">
              Este tipo não entra em receitas nem despesas do mês.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="tx-amount">Valor{account ? ` (${account.currency})` : ""}</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                value={amount}
                disabled={imported}
                aria-invalid={amount !== "" && (magnitude == null || magnitude <= 0)}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                type="date"
                value={occurredOn}
                disabled={imported}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-account">Conta</Label>
              <select
                id="tx-account"
                className={selectClass}
                value={accountId}
                disabled={imported}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution ? `${a.institution} · ${a.name}` : a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === "EXPENSE" ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={refund}
                onChange={(e) => setRefund(e.target.checked)}
                className="h-4 w-4"
              />
              É um estorno ou reembolso (reduz o gasto da categoria)
            </label>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">Notas</Label>
            <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {editing ? "Salvar" : "Criar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
