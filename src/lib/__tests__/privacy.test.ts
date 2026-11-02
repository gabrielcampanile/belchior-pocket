import { afterEach, describe, expect, it } from "vitest";
import {
  formatApprox,
  formatCents,
  formatCentsShort,
  formatPercent,
  formatSignedCents,
  HIDDEN_VALUE,
} from "@/lib/format";
import { setValuesHidden, toggleValuesHidden, valuesHidden } from "@/lib/privacy";

describe("esconder valores", () => {
  afterEach(() => setValuesHidden(false));

  it("1. mostra os valores por padrão", () => {
    expect(valuesHidden()).toBe(false);
    expect(formatCents(123456, "BRL")).toContain("1.234,56");
  });

  it("2. escondido, mantém a moeda e troca os dígitos pela máscara", () => {
    setValuesHidden(true);
    const out = formatCents(123456, "BRL");
    expect(out).toContain("R$");
    expect(out).toContain(HIDDEN_VALUE);
    expect(out).not.toMatch(/\d/);
    expect(formatCents(150_000, "BTC")).toBe(`₿ ${HIDDEN_VALUE}`);
    expect(formatCents(999, "USD")).toContain("US$");
  });

  it("3. a máscara tem o mesmo tamanho para qualquer valor (não vaza a ordem de grandeza)", () => {
    setValuesHidden(true);
    expect(formatCents(1, "BRL")).toBe(formatCents(74_100_000, "BRL"));
    expect(formatCentsShort(5, "BRL")).toBe(formatCents(5_000_000, "BRL"));
  });

  it("4. cobre as variantes com sinal e aproximadas, mas não percentuais", () => {
    setValuesHidden(true);
    expect(formatSignedCents(-5000, "BRL")).toMatch(/^−R\$\s••••$/);
    expect(formatApprox(5000, "BRL")).not.toMatch(/\d/);
    expect(formatPercent(0.25)).toBe("25,0%");
  });

  it("5. o toggle alterna e volta a mostrar", () => {
    toggleValuesHidden();
    expect(valuesHidden()).toBe(true);
    toggleValuesHidden();
    expect(formatCents(100, "BRL")).toContain("1,00");
  });
});
