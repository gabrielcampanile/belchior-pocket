import { describe, expect, it } from "vitest";
import { currentMonthKey, shiftMonth } from "@/lib/months";
import { monthFromSearch, monthToSearch, validateMonthSearch } from "@/lib/monthSearch";

describe("mês na URL", () => {
  it("1. aceita só YYYY-MM válido", () => {
    expect(validateMonthSearch({ mes: "2026-06" })).toEqual({ mes: "2026-06" });
    expect(validateMonthSearch({ mes: "2026-13" })).toEqual({});
    expect(validateMonthSearch({ mes: "junho" })).toEqual({});
    expect(validateMonthSearch({ mes: 202606 })).toEqual({});
    expect(validateMonthSearch({})).toEqual({});
  });

  it("2. sem mês, ou com mês no futuro, abre o mês atual", () => {
    const now = currentMonthKey();
    expect(monthFromSearch(undefined)).toBe(now);
    expect(monthFromSearch(shiftMonth(now, 2).slice(0, 7))).toBe(now);
    expect(monthFromSearch("2026-06")).toBe("2026-06-01" > now ? now : "2026-06-01");
  });

  it("3. o mês atual não aparece na URL; os outros sim", () => {
    const now = currentMonthKey();
    expect(monthToSearch(now)).toEqual({});
    expect(monthToSearch(shiftMonth(now, -3))).toEqual({ mes: shiftMonth(now, -3).slice(0, 7) });
  });
});
