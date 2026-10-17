import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toCurrencyCode } from "@/domain/currency";
import type { CashflowCategory, CashflowKind, CashflowTransaction } from "@/domain/cashflow";
import { OPEN_FINANCE_QUERY_KEY } from "@/hooks/useOpenFinanceSync";
import { useSession } from "@/hooks/useSession";
import { monthEndISO, monthStartISO, type MonthKey } from "@/lib/months";

// Under the Open Finance prefix, so a sync refreshes these screens too.
const CATEGORIES_KEY = [...OPEN_FINANCE_QUERY_KEY, "categories"] as const;
const CASHFLOW_KEY = [...OPEN_FINANCE_QUERY_KEY, "cashflow"] as const;

/** PostgREST caps a select at 1000 rows: page through with .range(). */
async function selectAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async (): Promise<CashflowCategory[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, kind, monthly_budget_cents, color")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        monthlyBudgetCents: c.monthly_budget_cents == null ? null : Number(c.monthly_budget_cents),
        color: c.color,
      }));
    },
  });
}

/** Income and expense rows of one or more months (TRANSFER & co. never reach the totals). */
export function useCashflowTransactions(fromMonth: MonthKey, toMonth: MonthKey = fromMonth) {
  return useQuery({
    queryKey: [...CASHFLOW_KEY, fromMonth, toMonth],
    queryFn: async (): Promise<CashflowTransaction[]> => {
      const rows = await selectAll((from, to) =>
        supabase
          .from("transactions")
          .select("id, amount_cents, currency, occurred_on, type, category_id")
          .gte("occurred_on", monthStartISO(fromMonth))
          .lt("occurred_on", monthEndISO(toMonth))
          .eq("hidden", false)
          .in("type", ["INCOME", "EXPENSE"])
          .order("id")
          .range(from, to),
      );
      return rows.map((t) => ({
        amountCents: Number(t.amount_cents),
        currency: toCurrencyCode(t.currency),
        occurredOn: String(t.occurred_on),
        type: t.type,
        categoryId: t.category_id,
      }));
    },
  });
}

export interface CategoryInput {
  name: string;
  kind: CashflowKind;
  monthlyBudgetCents: number | null;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("categories_name_uniq")) return "Já existe uma categoria com esse nome.";
  return "Não foi possível salvar a categoria.";
}

export function useCreateCategory() {
  const { userId } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("categories").insert({
        user_id: userId,
        name: input.name.trim(),
        kind: input.kind,
        monthly_budget_cents: input.kind === "EXPENSE" ? input.monthlyBudgetCents : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(friendlyError(err)),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: string }) => {
      const { error } = await supabase
        .from("categories")
        .update({
          name: input.name.trim(),
          monthly_budget_cents: input.kind === "EXPENSE" ? input.monthlyBudgetCents : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(friendlyError(err)),
  });
}

/**
 * Delete a category. With `mergeInto`, its transactions AND its Pluggy mapping move to the
 * target first, so future syncs land there too (this is how categories are merged).
 * Without it, transactions become uncategorized (FK on delete set null) and the mapping is
 * dropped, so a later sync may recreate a default category for that Pluggy group.
 */
export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, mergeInto }: { id: string; mergeInto: string | null }) => {
      if (mergeInto) {
        const mappings = await supabase
          .from("category_mappings")
          .update({ category_id: mergeInto })
          .eq("category_id", id);
        if (mappings.error) throw new Error(mappings.error.message);
        const txs = await supabase
          .from("transactions")
          .update({ category_id: mergeInto })
          .eq("category_id", id);
        if (txs.error) throw new Error(txs.error.message);
        // Rules pointing at the merged category follow it (otherwise they cascade away).
        const rules = await supabase
          .from("categorization_rules")
          .update({ category_id: mergeInto })
          .eq("category_id", id);
        if (rules.error) throw new Error(rules.error.message);
      }
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Não foi possível apagar a categoria."),
  });
}
