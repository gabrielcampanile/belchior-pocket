import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeSearch, type TxType } from "@/domain/transactions";
import {
  planRetroactivePatches,
  type CategorizationRule,
  type RuleDirection,
} from "@/domain/rules";
import { OPEN_FINANCE_QUERY_KEY } from "@/hooks/useOpenFinanceSync";
import { useSession } from "@/hooks/useSession";

const RULES_KEY = [...OPEN_FINANCE_QUERY_KEY, "rules"] as const;
const RULE_TARGETS_KEY = [...OPEN_FINANCE_QUERY_KEY, "rule-targets"] as const;

async function fetchRules(): Promise<CategorizationRule[]> {
  const { data, error } = await supabase
    .from("categorization_rules")
    .select("id, pattern, direction, set_type, category_id, created_at")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    pattern: r.pattern,
    direction: r.direction as RuleDirection,
    setType: r.set_type,
    categoryId: r.category_id,
    createdAt: r.created_at,
  }));
}

export interface RuleTargetRow {
  id: string;
  description: string;
  amountCents: number;
  type: string;
  categoryId: string | null;
  source: string;
  userOverridden: boolean;
  occurredOn: string;
}

/** Every imported transaction (whole history), for previews and retroactive application. */
async function fetchRuleTargets(): Promise<RuleTargetRow[]> {
  const rows: RuleTargetRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, description, amount_cents, type, category_id, source, user_overridden, occurred_on",
      )
      .eq("source", "IMPORT")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(
      ...(data ?? []).map((t) => ({
        id: t.id,
        description: t.description,
        amountCents: Number(t.amount_cents),
        type: t.type,
        categoryId: t.category_id,
        source: t.source,
        userOverridden: t.user_overridden,
        occurredOn: String(t.occurred_on),
      })),
    );
    if (!data || data.length < 1000) return rows;
  }
}

export function useRules() {
  return useQuery({ queryKey: RULES_KEY, queryFn: fetchRules });
}

export function useRuleTargets(enabled: boolean) {
  return useQuery({ queryKey: RULE_TARGETS_KEY, queryFn: fetchRuleTargets, enabled });
}

/** Re-run EVERY rule over the whole history (precedence stays consistent). */
async function applyAllRules(): Promise<number> {
  const [rules, targets] = await Promise.all([fetchRules(), fetchRuleTargets()]);
  const patches = planRetroactivePatches(rules, targets);
  let changed = 0;
  for (let i = 0; i < patches.length; i += 500) {
    const batch = patches.slice(i, i + 500).map((p) => ({
      id: p.id,
      type: p.type,
      category_id: p.categoryId,
      amount_cents: p.amountCents,
    }));
    const { data, error } = await supabase.rpc("apply_transaction_patches", {
      patches: batch as unknown as Json,
    });
    if (error) throw new Error(error.message);
    changed += data ?? 0;
  }
  return changed;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
}

function changedLabel(n: number): string {
  if (n === 0) return "nenhuma transação do passado precisou mudar";
  return n === 1 ? "1 transação atualizada" : `${n} transações atualizadas`;
}

export interface RuleInput {
  pattern: string;
  direction: RuleDirection;
  setType: TxType | null;
  categoryId: string | null;
}

export function useCreateRule() {
  const { userId } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: RuleInput) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("categorization_rules").insert({
        user_id: userId,
        pattern: normalizeSearch(input.pattern),
        direction: input.direction,
        set_type: input.setType,
        category_id: input.categoryId,
      });
      if (error) {
        if (error.message.includes("categorization_rules_uniq")) {
          throw new Error("Já existe uma regra com esse texto e direção.");
        }
        throw new Error(error.message);
      }
      return applyAllRules();
    },
    onSuccess: (changed) => {
      toast.success(`Regra criada: ${changedLabel(changed)}. Os próximos syncs também a usam.`);
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a regra."),
  });
}

/** Deleting a rule does not revert past rows; the next sync stops applying it to new ones. */
export function useDeleteRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorization_rules").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Regra apagada. As transações já classificadas ficam como estão.");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível apagar a regra."),
  });
}

export function useReapplyRules() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: applyAllRules,
    onSuccess: (changed) => {
      toast.success(`Regras reaplicadas: ${changedLabel(changed)}.`);
      void invalidate();
    },
    onError: () => toast.error("Não foi possível reaplicar as regras."),
  });
}
