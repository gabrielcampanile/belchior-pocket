import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RulesList } from "@/components/finance/RulesList";
import type { CashflowCategory, CashflowKind } from "@/domain/cashflow";
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryInput,
} from "@/hooks/useCashflow";
import { centsToInput, formatCents, parseCurrencyToCents } from "@/lib/format";

/**
 * Categories and the fixed monthly budget, edited in place from the "Mês atual" screen.
 * Budgets exist only for EXPENSE categories and are in BRL.
 */
export function CategoryBudgetEditor({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CashflowCategory[];
}) {
  const totalBudget = categories
    .filter((c) => c.kind === "EXPENSE")
    .reduce((sum, c) => sum + (c.monthlyBudgetCents ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Categorias e orçamento</SheetTitle>
          <SheetDescription>
            Orçamento mensal fixo por categoria de despesa, em reais. Total:{" "}
            {formatCents(totalBudget, "BRL")}.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="EXPENSE" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
            <TabsTrigger value="INCOME">Receitas</TabsTrigger>
            <TabsTrigger value="RULES">Regras</TabsTrigger>
          </TabsList>
          <TabsContent value="RULES" className="mt-4">
            <RulesList categories={categories} />
          </TabsContent>
          {(["EXPENSE", "INCOME"] as const).map((kind) => (
            <TabsContent key={kind} value={kind} className="mt-4 space-y-3">
              <NewCategoryRow kind={kind} />
              {categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    siblings={categories.filter((s) => s.kind === kind && s.id !== c.id)}
                  />
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function budgetFromInput(raw: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const cents = parseCurrencyToCents(raw);
  return cents == null || cents < 0 ? "invalid" : cents;
}

function CategoryRow({
  category,
  siblings,
}: {
  category: CashflowCategory;
  siblings: CashflowCategory[];
}) {
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState(category.name);
  const [budget, setBudget] = useState(centsToInput(category.monthlyBudgetCents));
  const [confirming, setConfirming] = useState(false);
  const [mergeInto, setMergeInto] = useState("");

  const parsed = budgetFromInput(budget);
  const dirty =
    name.trim() !== category.name ||
    (category.kind === "EXPENSE" && parsed !== category.monthlyBudgetCents);
  const valid = name.trim().length > 0 && parsed !== "invalid";
  const idBase = `cat-${category.id}`;

  const save = () => {
    if (!valid || !dirty) return;
    update.mutate({
      id: category.id,
      name,
      kind: category.kind,
      monthlyBudgetCents: parsed,
    });
  };

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${idBase}-name`} className="sr-only">
            Nome da categoria
          </Label>
          <Input
            id={`${idBase}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        {category.kind === "EXPENSE" ? (
          <div className="w-32 space-y-1">
            <Label htmlFor={`${idBase}-budget`} className="text-xs text-muted-foreground">
              Orçamento (R$)
            </Label>
            <Input
              id={`${idBase}-budget`}
              inputMode="decimal"
              placeholder="sem"
              value={budget}
              aria-invalid={parsed === "invalid"}
              onChange={(e) => setBudget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
        ) : null}
        <Button
          size="sm"
          onClick={save}
          disabled={!dirty || !valid || update.isPending}
          aria-label={`Salvar ${category.name}`}
        >
          Salvar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setConfirming((v) => !v)}
          aria-label={`Apagar ${category.name}`}
          aria-expanded={confirming}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {confirming ? (
        <div className="mt-3 space-y-2 rounded-lg bg-surface/60 p-3 text-sm">
          <Label htmlFor={`${idBase}-merge`}>Mover as transações para</Label>
          <select
            id={`${idBase}-merge`}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={mergeInto}
            onChange={(e) => setMergeInto(e.target.value)}
          >
            <option value="">Nenhuma (ficam sem categoria)</option>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {mergeInto
              ? "As próximas sincronizações também passam a usar a categoria escolhida."
              : "Sem destino, uma próxima sincronização pode recriar esta categoria."}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: category.id, mergeInto: mergeInto || null })}
            >
              {mergeInto ? "Juntar e apagar" : "Apagar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NewCategoryRow({ kind }: { kind: CashflowKind }) {
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const parsed = budgetFromInput(budget);
  const valid = name.trim().length > 0 && parsed !== "invalid";
  const id = `new-${kind}`;

  const submit = () => {
    if (!valid) return;
    const input: CategoryInput = {
      name,
      kind,
      monthlyBudgetCents: parsed,
    };
    create.mutate(input, {
      onSuccess: () => {
        setName("");
        setBudget("");
      },
    });
  };

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={`${id}-name`} className="text-xs text-muted-foreground">
          Nova categoria de {kind === "EXPENSE" ? "despesa" : "receita"}
        </Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      {kind === "EXPENSE" ? (
        <div className="w-32 space-y-1">
          <Label htmlFor={`${id}-budget`} className="text-xs text-muted-foreground">
            Orçamento (R$)
          </Label>
          <Input
            id={`${id}-budget`}
            inputMode="decimal"
            placeholder="sem"
            value={budget}
            aria-invalid={parsed === "invalid"}
            onChange={(e) => setBudget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      ) : null}
      <Button size="sm" onClick={submit} disabled={!valid || create.isPending}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Criar
      </Button>
    </div>
  );
}
