import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CurrencyCode } from "@/domain/currency";
import { formatCents, formatCentsShort } from "@/lib/format";
import { MAX_SLICES, PALETTE } from "./categoryColors";

export interface DonutSlice {
  categoryId: string | null;
  name: string;
  total: number;
}

export function CategoryDonut({
  slices,
  currency,
  emptyLabel = "Sem dados no período",
  compact = false,
}: {
  slices: DonutSlice[];
  currency: CurrencyCode;
  emptyLabel?: string;
  /** Smaller, no legend (the list beside it is the legend), total in the center. */
  compact?: boolean;
}) {
  const data = useMemo(() => {
    const positive = slices.filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
    if (positive.length <= MAX_SLICES) return positive;
    const head = positive.slice(0, MAX_SLICES - 1);
    const rest = positive.slice(MAX_SLICES - 1).reduce((sum, s) => sum + s.total, 0);
    return [...head, { categoryId: "__other__", name: "Outros", total: rest }];
  }, [slices]);

  const total = data.reduce((sum, s) => sum + s.total, 0);
  const height = compact ? "h-44" : "h-64";

  if (!total) {
    return (
      <div
        className={`flex ${height} items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`relative ${height} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius={compact ? "68%" : "58%"}
            outerRadius={compact ? "95%" : "82%"}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((slice, index) => (
              <Cell
                key={slice.categoryId ?? `slice-${index}`}
                fill={PALETTE[index % PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              color: "var(--popover-foreground)",
              fontSize: "0.8rem",
            }}
            formatter={(value: number, name: string) => [
              `${formatCents(value, currency)} · ${((value / total) * 100).toFixed(1)}%`,
              name,
            ]}
          />
          {!compact ? (
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
      {compact ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCentsShort(total, currency)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
