import { describe, expect, it } from "vitest";
import {
  canDeleteManualAccount,
  manualAccountBalance,
  validateManualAccountName,
} from "@/domain/manualAccounts";

describe("manualAccounts", () => {
  it("1. saldo = inicial + todas as transações visíveis, de qualquer tipo", () => {
    expect(
      manualAccountBalance(10_000, [
        { amountCents: -2_500 }, // despesa
        { amountCents: 50_000 }, // transferência de entrada
        { amountCents: -99_999, hidden: true },
      ]),
    ).toBe(57_500);
    expect(manualAccountBalance(0, [])).toBe(0);
  });

  it("2. só apaga conta sem transações (senão o histórico sumiria)", () => {
    expect(canDeleteManualAccount(0)).toBe(true);
    expect(canDeleteManualAccount(1)).toBe(false);
  });

  it("3. nome obrigatório e curto", () => {
    expect(validateManualAccountName("  ")).not.toBeNull();
    expect(validateManualAccountName("x".repeat(61))).not.toBeNull();
    expect(validateManualAccountName(" Carteira ")).toBeNull();
  });
});
