import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CashflowCategory } from "@/domain/cashflow";
import { RULE_DIRECTION_LABEL, sortRules } from "@/domain/rules";
import { TX_TYPE_LABEL } from "@/domain/transactions";
import { useDeleteRule, useReapplyRules, useRules } from "@/hooks/useRules";

/** The user's categorization rules, most specific first (the order they are applied in). */
export function RulesList({ categories }: { categories: CashflowCategory[] }) {
  const { data: rules = [], isLoading } = useRules();
  const remove = useDeleteRule();
  const reapply = useReapplyRules();
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Crie regras em Transações, pelo botão de varinha numa transação ou depois de recategorizar.
        Quando mais de uma bate, vale a de texto mais longo.
      </p>
      {rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma regra ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortRules(rules).map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">“{r.pattern}”</p>
                <p className="text-xs text-muted-foreground">
                  {RULE_DIRECTION_LABEL[r.direction]} →{" "}
                  {[
                    r.setType ? TX_TYPE_LABEL[r.setType] : null,
                    r.categoryId ? (nameById.get(r.categoryId) ?? "categoria apagada") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(r.id)}
                aria-label={`Apagar a regra ${r.pattern}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {rules.length > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={reapply.isPending}
          onClick={() => reapply.mutate()}
        >
          <RefreshCw
            className={reapply.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
            aria-hidden="true"
          />
          Reaplicar todas ao histórico
        </Button>
      ) : null}
    </div>
  );
}
