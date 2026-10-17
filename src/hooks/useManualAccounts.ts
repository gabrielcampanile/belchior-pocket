import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toCurrencyCode, type CurrencyCode } from "@/domain/currency";
import {
  canDeleteManualAccount,
  manualAccountBalance,
  type ManualAccountKind,
} from "@/domain/manualAccounts";
import { OPEN_FINANCE_QUERY_KEY } from "@/hooks/useOpenFinanceSync";
import { useSession } from "@/hooks/useSession";

const MANUAL_ACCOUNTS_KEY = [...OPEN_FINANCE_QUERY_KEY, "manual-accounts"] as const;

export interface ManualAccount {
  id: string;
  name: string;
  kind: ManualAccountKind;
  currency: CurrencyCode;
  openingCents: number;
  balanceCents: number;
  transactionCount: number;
  archived: boolean;
}

export function useManualAccounts() {
  return useQuery({
    queryKey: MANUAL_ACCOUNTS_KEY,
    queryFn: async (): Promise<ManualAccount[]> => {
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id, name, kind, currency, balance_cents, archived")
        .eq("source", "MANUAL")
        .order("name");
      if (error) throw new Error(error.message);
      if (!accounts?.length) return [];

      // Manual accounts hold few rows; one page per account set is plenty, but page anyway.
      const txs: { account_id: string; amount_cents: number; hidden: boolean }[] = [];
      for (let from = 0; ; from += 1000) {
        const page = await supabase
          .from("transactions")
          .select("account_id, amount_cents, hidden")
          .in(
            "account_id",
            accounts.map((a) => a.id),
          )
          .order("id")
          .range(from, from + 999);
        if (page.error) throw new Error(page.error.message);
        txs.push(...(page.data ?? []));
        if (!page.data || page.data.length < 1000) break;
      }

      return accounts.map((a) => {
        const own = txs
          .filter((t) => t.account_id === a.id)
          .map((t) => ({ amountCents: Number(t.amount_cents), hidden: t.hidden }));
        const opening = Number(a.balance_cents);
        return {
          id: a.id,
          name: a.name,
          kind: a.kind as ManualAccountKind,
          currency: toCurrencyCode(a.currency),
          openingCents: opening,
          balanceCents: manualAccountBalance(opening, own),
          transactionCount: own.length,
          archived: a.archived,
        };
      });
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
}

export interface ManualAccountInput {
  name: string;
  kind: ManualAccountKind;
  currency: CurrencyCode;
  /** For a manual account, balance_cents stores the OPENING balance. */
  openingCents: number;
}

export function useCreateManualAccount() {
  const { userId } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: ManualAccountInput) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("accounts").insert({
        user_id: userId,
        source: "MANUAL",
        connection_id: null,
        provider_account_id: null,
        name: input.name.trim(),
        kind: input.kind,
        currency: input.currency,
        balance_cents: input.openingCents,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conta criada.");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível criar a conta."),
  });
}

/** Currency is fixed after creation: the account's transactions are stored in it. */
export function useUpdateManualAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<Pick<ManualAccountInput, "name" | "kind" | "openingCents">> & {
        archived?: boolean;
      }) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          ...(patch.name != null ? { name: patch.name.trim() } : {}),
          ...(patch.kind ? { kind: patch.kind } : {}),
          ...(patch.openingCents != null ? { balance_cents: patch.openingCents } : {}),
          ...(patch.archived != null ? { archived: patch.archived } : {}),
        })
        .eq("id", id)
        .eq("source", "MANUAL");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Não foi possível salvar a conta."),
  });
}

export function useDeleteManualAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      // Re-check on the server side of the race: never cascade away transactions.
      const { count, error: countError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("account_id", id);
      if (countError) throw new Error(countError.message);
      if (!canDeleteManualAccount(count ?? 0)) {
        throw new Error("A conta tem lançamentos; arquive em vez de apagar.");
      }
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", id)
        .eq("source", "MANUAL");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conta apagada.");
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar a conta."),
  });
}
