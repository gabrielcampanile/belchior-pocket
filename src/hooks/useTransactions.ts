import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toCurrencyCode, type CurrencyCode } from "@/domain/currency";
import { categoryKindForType, type ListTransaction, type TxType } from "@/domain/transactions";
import { OPEN_FINANCE_QUERY_KEY } from "@/hooks/useOpenFinanceSync";
import { useSession } from "@/hooks/useSession";
import { monthEndISO, monthStartISO, type MonthKey } from "@/lib/months";

const TX_KEY = [...OPEN_FINANCE_QUERY_KEY, "transactions"] as const;
const ACCOUNTS_KEY = [...OPEN_FINANCE_QUERY_KEY, "accounts"] as const;

export interface TransactionRow extends ListTransaction {
  currency: CurrencyCode;
  status: "PENDING" | "POSTED";
  source: "IMPORT" | "MANUAL";
  userOverridden: boolean;
  operationType: string | null;
}

export interface AccountOption {
  id: string;
  name: string;
  institution: string | null;
  kind: string;
  currency: CurrencyCode;
}

export function useAccountOptions() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async (): Promise<AccountOption[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, kind, currency, provider_connections(institution_name)")
        .eq("archived", false)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        currency: toCurrencyCode(a.currency),
        institution:
          (a.provider_connections as { institution_name: string } | null)?.institution_name ?? null,
      }));
    },
  });
}

/** Every transaction of the period, hidden ones included (the screen filters them). */
export function useTransactionList(fromMonth: MonthKey, toMonth: MonthKey) {
  return useQuery({
    queryKey: [...TX_KEY, fromMonth, toMonth],
    queryFn: async (): Promise<TransactionRow[]> => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, account_id, description, notes, amount_cents, currency, occurred_on, type, category_id, hidden, status, source, user_overridden, provider_operation_type",
          )
          .gte("occurred_on", monthStartISO(fromMonth))
          .lt("occurred_on", monthEndISO(toMonth))
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows.map((t) => ({
        id: t.id,
        accountId: t.account_id,
        description: t.description,
        notes: t.notes,
        amountCents: Number(t.amount_cents),
        currency: toCurrencyCode(t.currency),
        occurredOn: String(t.occurred_on),
        type: t.type,
        categoryId: t.category_id,
        hidden: t.hidden,
        status: t.status,
        source: t.source,
        userOverridden: t.user_overridden,
        operationType: t.provider_operation_type,
      }));
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
}

export interface TransactionInput {
  accountId: string;
  description: string;
  notes: string | null;
  /** Already signed for the type (see signedAmountForType). */
  amountCents: number;
  occurredOn: string;
  type: TxType;
  categoryId: string | null;
}

/** A category only makes sense for income/expense; anything else is stored uncategorized. */
function categoryFor(input: Pick<TransactionInput, "type" | "categoryId">) {
  return categoryKindForType(input.type) ? input.categoryId : null;
}

export function useCreateTransaction() {
  const { userId } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: TransactionInput & { currency: CurrencyCode }) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        account_id: input.accountId,
        description: input.description.trim(),
        notes: input.notes?.trim() || null,
        amount_cents: input.amountCents,
        currency: input.currency,
        occurred_on: input.occurredOn,
        type: input.type,
        category_id: categoryFor(input),
        source: "MANUAL",
        status: "POSTED",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lançamento criado.");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível criar o lançamento."),
  });
}

/**
 * Edit a row. For an Open Finance row this sets user_overridden, so the sync never
 * overwrites the edit; the bank's amount, date and account are not editable there.
 */
export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      source,
      input,
    }: {
      id: string;
      source: "IMPORT" | "MANUAL";
      input: TransactionInput;
    }) => {
      const common = {
        description: input.description.trim(),
        notes: input.notes?.trim() || null,
        type: input.type,
        category_id: categoryFor(input),
        amount_cents: input.amountCents,
      };
      const patch =
        source === "MANUAL"
          ? { ...common, account_id: input.accountId, occurred_on: input.occurredOn }
          : { ...common, user_overridden: true };
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Não foi possível salvar a transação."),
  });
}

/** Quick recategorization from the list (marks Open Finance rows as overridden). */
export function useSetCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      source,
      categoryId,
    }: {
      id: string;
      source: "IMPORT" | "MANUAL";
      categoryId: string | null;
    }) => {
      const patch =
        source === "IMPORT"
          ? { category_id: categoryId, user_overridden: true }
          : { category_id: categoryId };
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Não foi possível recategorizar."),
  });
}

/** Hide/unhide. Open Finance rows are hidden, never deleted (they would come back). */
export function useSetHidden() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase.from("transactions").update({ hidden }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, { hidden }) => {
      toast.success(hidden ? "Transação oculta dos totais." : "Transação visível de novo.");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível alterar a transação."),
  });
}

/** Only MANUAL rows can be deleted. */
export function useDeleteManualTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("source", "MANUAL");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lançamento apagado.");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível apagar o lançamento."),
  });
}
