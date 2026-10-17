import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Trash2, Wallet } from "lucide-react";
import { EmptyState, Panel, SectionHeader } from "@/components/finance/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCY_CODES, type CurrencyCode } from "@/domain/currency";
import {
  canDeleteManualAccount,
  MANUAL_ACCOUNT_KIND_LABEL,
  MANUAL_ACCOUNT_KINDS,
  validateManualAccountName,
  type ManualAccountKind,
} from "@/domain/manualAccounts";
import {
  useCreateManualAccount,
  useDeleteManualAccount,
  useManualAccounts,
  useUpdateManualAccount,
  type ManualAccount,
} from "@/hooks/useManualAccounts";
import { centsToInput, formatCents, parseCurrencyToCents } from "@/lib/format";
import { cn } from "@/lib/utils";

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

/** Accounts outside Open Finance (e.g. cash), shown on the Conexões screen. */
export function ManualAccountsPanel() {
  const { data: accounts = [], isLoading, error } = useManualAccounts();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const visible = accounts.filter((a) => showArchived || !a.archived);
  const archivedCount = accounts.filter((a) => a.archived).length;

  return (
    <Panel className="space-y-4">
      <SectionHeader
        title="Contas manuais"
        description="Dinheiro em espécie ou contas fora do Open Finance. Os lançamentos são criados em Transações."
        action={
          <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Nova conta
          </Button>
        }
      />

      {creating ? <NewManualAccountForm onDone={() => setCreating(false)} /> : null}

      {error ? (
        <p className="text-sm text-negative">Não foi possível carregar as contas manuais.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 && !creating ? (
        <EmptyState
          title="Nenhuma conta manual"
          description="Crie uma conta como “Carteira” para registrar gastos em dinheiro."
        />
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((a) => (
            <ManualAccountRow key={a.id} account={a} />
          ))}
        </ul>
      )}

      {archivedCount > 0 ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Mostrar arquivadas ({archivedCount})
        </label>
      ) : null}
    </Panel>
  );
}

function NewManualAccountForm({ onDone }: { onDone: () => void }) {
  const create = useCreateManualAccount();
  const [name, setName] = useState("Carteira");
  const [kind, setKind] = useState<ManualAccountKind>("CASH");
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [opening, setOpening] = useState("");
  const nameError = validateManualAccountName(name);
  const openingCents = opening.trim() ? parseCurrencyToCents(opening) : 0;
  const valid = !nameError && openingCents != null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || openingCents == null) return;
    create.mutate({ name, kind, currency, openingCents }, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="ma-name">Nome</Label>
        <Input
          id="ma-name"
          value={name}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "ma-name-error" : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {nameError ? (
          <p id="ma-name-error" className="text-xs text-negative">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="ma-kind">Tipo</Label>
        <select
          id="ma-kind"
          className={selectClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as ManualAccountKind)}
        >
          {MANUAL_ACCOUNT_KINDS.map((k) => (
            <option key={k} value={k}>
              {MANUAL_ACCOUNT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ma-currency">Moeda</Label>
        <select
          id="ma-currency"
          className={selectClass}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ma-opening">Saldo inicial</Label>
        <Input
          id="ma-opening"
          inputMode="decimal"
          placeholder="0,00"
          value={opening}
          aria-invalid={openingCents == null}
          onChange={(e) => setOpening(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid || create.isPending}>
          Criar conta
        </Button>
      </div>
    </form>
  );
}

function ManualAccountRow({ account }: { account: ManualAccount }) {
  const update = useUpdateManualAccount();
  const remove = useDeleteManualAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [opening, setOpening] = useState(centsToInput(account.openingCents));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameError = validateManualAccountName(name);
  const openingCents = opening.trim() ? parseCurrencyToCents(opening) : 0;
  const deletable = canDeleteManualAccount(account.transactionCount);
  const idBase = `ma-${account.id}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || openingCents == null) return;
    update.mutate({ id: account.id, name, openingCents }, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor={`${idBase}-name`} className="text-xs text-muted-foreground">
              Nome
            </Label>
            <Input
              id={`${idBase}-name`}
              value={name}
              aria-invalid={!!nameError}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-36 space-y-1">
            <Label htmlFor={`${idBase}-opening`} className="text-xs text-muted-foreground">
              Saldo inicial ({account.currency})
            </Label>
            <Input
              id={`${idBase}-opening`}
              inputMode="decimal"
              value={opening}
              aria-invalid={openingCents == null}
              onChange={(e) => setOpening(e.target.value)}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!!nameError || openingCents == null || update.isPending}
          >
            Salvar
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3 py-3", account.archived && "opacity-60")}>
      <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {MANUAL_ACCOUNT_KIND_LABEL[account.kind] ?? account.kind} · {account.currency} ·{" "}
          {account.transactionCount} lançamentos
          {account.archived ? (
            <Badge variant="outline" className="ml-2">
              Arquivada
            </Badge>
          ) : null}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-foreground">
          {formatCents(account.balanceCents, account.currency)}
        </p>
        <p className="text-xs text-muted-foreground">
          inicial {formatCents(account.openingCents, account.currency)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: account.id, archived: !account.archived })}
          aria-label={account.archived ? `Desarquivar ${account.name}` : `Arquivar ${account.name}`}
        >
          {account.archived ? (
            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Archive className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        {deletable ? (
          confirmDelete ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(account.id)}
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
              aria-label={`Apagar ${account.name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}
