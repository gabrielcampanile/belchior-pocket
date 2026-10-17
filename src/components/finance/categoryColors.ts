/** Paleta determinística: a mesma posição recebe sempre a mesma cor. */
export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/** The donut shows at most this many slices; the rest are folded into "Outros". */
export const MAX_SLICES = 6;

/**
 * Color of the row at `index` in a list sorted by total desc, matching the donut: the first
 * MAX_SLICES-1 get their own color, everything after shares the "Outros" color.
 */
export function sliceColor(index: number, count: number): string {
  if (count > MAX_SLICES && index >= MAX_SLICES - 1) return PALETTE[MAX_SLICES - 1];
  return PALETTE[index % PALETTE.length];
}
