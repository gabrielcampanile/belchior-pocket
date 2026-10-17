import { useMemo } from "react";
import type { CategoryTotal } from "@/domain/cashflow";
import type { CurrencyCode } from "@/domain/currency";
import { formatCentsShort, formatPercent } from "@/lib/format";
import { sliceColor } from "./categoryColors";

/**
 * Category share as a list: color (matches the donut), name, %, total and a share bar.
 * With `months`, the second line also shows the average per month.
 */
export function CategoryShareList({
  rows,
  currency,
  months,
}: {
  rows: CategoryTotal[];
  currency: CurrencyCode;
  months?: number;
}) {
  const sorted = useMemo(
    () => rows.filter((r) => r.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents),
    [rows],
  );
  if (sorted.length === 0) return null;
  return (
    <ul className="divide-y divide-border" aria-label="Total e percentual por categoria">
      {sorted.map((r, i) => (
        <li key={r.categoryId ?? "none"} className="py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: sliceColor(i, sorted.length) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatPercent(r.share, 0)}
            </span>
            <span className="w-24 shrink-0 text-right font-medium tabular-nums">
              {formatCentsShort(r.totalCents, currency)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 pl-[18px]">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, r.share * 100)}%`,
                  background: sliceColor(i, sorted.length),
                }}
              />
            </div>
            {months ? (
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {formatCentsShort(Math.round(r.totalCents / months), currency)}/mês
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
