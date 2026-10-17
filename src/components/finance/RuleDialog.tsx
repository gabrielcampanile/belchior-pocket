import { useEffect, useMemo, useState } from "react";
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
  RULE_DIRECTION_LABEL,
  ruleMatches,
  suggestPattern,
  validateRule,
  type RuleDirection,
} from "@/domain/rules";
import {
  categoryKindForType,
  normalizeSearch,
  TX_TYPE_LABEL,
  TX_TYPES,
  type TxType,
} from "@/domain/transactions";
import { useCreateRule, useRuleTargets } from "@/hooks/useRules";
import { formatDateBR } from "@/lib/months";

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

export interface RuleSeed {
  description: string;
  amountCents: number;
  type: string;
  categoryId: string | null;
}

/**
 * Create a categorization rule, usually seeded from a transaction the user just fixed.
 * Shows, live, which past transactions it will change before anything is written.
 */
export function RuleDialog({
  open,
  onOpenChange,
  seed,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: RuleSeed | null;
  categories: CashflowCategory[];
}) {
  const create = useCreateRule();
  const targets = useRuleTargets(open);
  const [pattern, setPattern] = useState("");
  const [direction, setDirection] = useState<RuleDirection>("ANY");
  const [setType, setSetType] = useState<TxType | "">("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!open) return;
    setPattern(seed ? suggestPattern(seed.description) : "");
    setDirection(seed ? (seed.amountCents > 0 ? "IN" : "OUT") : "ANY");
    setSetType(seed ? (seed.type as TxType) : "");
    setCategoryId(seed?.categoryId ?? "");
  }, [open, seed]);

  const effectiveType = setType || null;
  const kind = effectiveType ? categoryKindForType(effectiveType) : null;
  const options = effectiveType
    ? kind
      ? categories.filter((c) => c.kind === kind)
      : []
    : categories;
  const error = validateRule({ pattern, setType: effectiveType, categoryId: categoryId || null });

  const rule = useMemo(
    () => ({
      id: "preview",
      pattern: normalizeSearch(pattern),
      direction,
      setType: effectiveType,
      categoryId: categoryId || null,
      createdAt: "",
    }),
    [pattern, direction, effectiveType, categoryId],
  );
  const matches = useMemo(
    () =>
      error
        ? []
        : (targets.data ?? [])
            .filter((t) => ruleMatches(rule, t))
            .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    [targets.data, rule, error],
  );
  const protectedCount = matches.filter((m) => m.userOverridden).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    create.mutate(
      { pattern, direction, setType: effectiveType, categoryId: categoryId || null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Regra de categorização</DialogTitle>
            <DialogDescription>
              Vale para as transações do passado e para todas que chegarem nos próximos syncs.
              Edições que você fez à mão numa transação continuam valendo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="rule-pattern">Quando a descrição contém</Label>
            <Input
              id="rule-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              aria-describedby="rule-pattern-hint"
            />
            <p id="rule-pattern-hint" className="text-xs text-muted-foreground">
              Sem diferença de maiúsculas e acentos. Corte datas e números que mudam a cada mês.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-direction">Movimento</Label>
              <select
                id="rule-direction"
                className={selectClass}
                value={direction}
                onChange={(e) => setDirection(e.target.value as RuleDirection)}
              >
                {(Object.keys(RULE_DIRECTION_LABEL) as RuleDirection[]).map((d) => (
                  <option key={d} value={d}>
                    {RULE_DIRECTION_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-type">Vira o tipo</Label>
              <select
                id="rule-type"
                className={selectClass}
                value={setType}
                onChange={(e) => {
                  setSetType(e.target.value as TxType | "");
                  setCategoryId("");
                }}
              >
                <option value="">Manter o tipo</option>
                {TX_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TX_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-category">Na categoria</Label>
              <select
                id="rule-category"
                className={selectClass}
                value={categoryId}
                disabled={!!effectiveType && !kind}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">
                  {effectiveType && !kind ? "Não se aplica" : "Manter a categoria"}
                </option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {effectiveType
                      ? c.name
                      : `${c.name} (${c.kind === "INCOME" ? "receita" : "despesa"})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border p-3 text-sm" aria-live="polite">
            {error ? (
              <p className="text-muted-foreground">{error}</p>
            ) : targets.isLoading ? (
              <p className="text-muted-foreground">Procurando transações parecidas…</p>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  {matches.length === 0
                    ? "Nenhuma transação do passado bate com essa regra."
                    : `${matches.length} ${matches.length === 1 ? "transação bate" : "transações batem"} com essa regra.`}
                  {protectedCount > 0
                    ? ` ${protectedCount} editada${protectedCount === 1 ? "" : "s"} à mão não muda${protectedCount === 1 ? "" : "m"}.`
                    : ""}
                </p>
                {matches.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {matches.slice(0, 5).map((m) => (
                      <li key={m.id} className="flex justify-between gap-3">
                        <span className="truncate">{m.description}</span>
                        <span className="shrink-0 tabular-nums">{formatDateBR(m.occurredOn)}</span>
                      </li>
                    ))}
                    {matches.length > 5 ? <li>e mais {matches.length - 5}…</li> : null}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!!error || create.isPending}>
              {create.isPending ? "Aplicando…" : "Criar e aplicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
