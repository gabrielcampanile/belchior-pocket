import { describe, expect, it } from "vitest";
import { money } from "@/domain/currency";
import {
  convertMoney,
  createConverter,
  findRate,
  sumMoney,
  type ExchangeRate,
} from "@/domain/exchange";
import { formatCents } from "@/lib/format";

const rates: ExchangeRate[] = [
  { base: "CAD", quote: "BRL", rate: 3.5, effectiveOn: "2026-01-10", source: "test" },
  { base: "CAD", quote: "BRL", rate: 4, effectiveOn: "2026-03-01", source: "test" },
  { base: "BRL", quote: "USD", rate: 0.2, effectiveOn: "2026-03-01", source: "test" },
  { base: "BRL", quote: "EUR", rate: 0.17, effectiveOn: "2026-03-01", source: "test" },
];

describe("câmbio determinístico", () => {
  it("1. mesma moeda não converte", () => {
    expect(convertMoney(money(10_000, "BRL"), "BRL", rates)).toEqual(money(10_000, "BRL"));
  });

  it("2. 100 CAD com taxa 4 vira 400 BRL", () => {
    expect(convertMoney(money(10_000, "CAD"), "BRL", rates, "2026-03-15")).toEqual(
      money(40_000, "BRL"),
    );
  });

  it("3. usa a cotação vigente na data histórica, não a atual", () => {
    expect(convertMoney(money(10_000, "CAD"), "BRL", rates, "2026-02-01")).toEqual(
      money(35_000, "BRL"),
    );
  });

  it("4. converte pelo par invertido quando só existe o inverso", () => {
    expect(findRate(rates, "BRL", "CAD", "2026-03-15")).toBeCloseTo(0.25, 10);
  });

  it("5. tri  angula via BRL quando não há par direto", () => {
    // CAD→BRL (4) × BRL→USD (0,2) = 0,8
    expect(findRate(rates, "CAD", "USD", "2026-03-15")).toBeCloseTo(0.8, 10);
  });

  it("6. sem cotação disponível retorna null (nunca inventa taxa)", () => {
    expect(convertMoney(money(1_000, "ARS"), "BRL", rates, "2026-03-15")).toBeNull();
  });

  it("7. soma multimoeda converte antes de agregar", () => {
    const total = sumMoney(
      [money(10_000, "BRL"), money(10_000, "CAD")],
      "BRL",
      rates,
      "2026-03-15",
    );
    expect(total).toEqual(money(50_000, "BRL"));
  });

  it("8. conversão é reproduzível para a mesma entrada", () => {
    const convert = createConverter("BRL", rates);
    const a = convert(money(12_345, "CAD"), "2026-03-15");
    const b = convert(money(12_345, "CAD"), "2026-03-15");
    expect(a).toBe(b);
    expect(a).toBe(49_380);
  });

  it("9. formatação respeita a moeda alvo", () => {
    expect(formatCents(40_000, "BRL").replace(/\u00a0/g, " ")).toBe("R$ 400,00");
    expect(formatCents(10_000, "CAD")).toContain("100,00");
    expect(formatCents(10_000, "USD")).toContain("100,00");
  });

  it("data anterior a qualquer cotação usa a mais antiga conhecida", () => {
    expect(convertMoney(money(10_000, "CAD"), "BRL", rates, "2025-01-01")).toEqual(
      money(35_000, "BRL"),
    );
  });
});

describe("bitcoin (satoshis, 8 casas)", () => {
  // 1 BTC = R$ 350.000,00  ->  1 BRL = 1/350000 BTC
  const btcRates: ExchangeRate[] = [
    { base: "BRL", quote: "BTC", rate: 1 / 350_000, effectiveOn: "2026-10-16", source: "test" },
    { base: "BRL", quote: "USD", rate: 0.2, effectiveOn: "2026-10-16", source: "test" },
  ];

  it("B1. 0,001 BTC (100.000 sats) vira R$ 350,00 (35.000 centavos)", () => {
    expect(convertMoney(money(100_000, "BTC"), "BRL", btcRates)).toEqual(money(35_000, "BRL"));
  });

  it("B2. R$ 350,00 vira 100.000 sats; triangulação BTC -> USD via BRL", () => {
    expect(convertMoney(money(35_000, "BRL"), "BTC", btcRates)).toEqual(money(100_000, "BTC"));
    // 0,001 BTC = R$ 350 = US$ 70
    expect(convertMoney(money(100_000, "BTC"), "USD", btcRates)).toEqual(money(7_000, "USD"));
  });

  it("B3. sem cotação, o fallback reescala e nunca soma satoshis como centavos", () => {
    const toBrl = createConverter("BRL", []);
    expect(toBrl(money(100_000, "BTC"))).toBe(0); // 0,001 "BRL" arredonda para 0 centavos
    expect(toBrl(money(1_000, "CAD"))).toBe(1_000); // fiat continua 1:1 como antes
  });

  it("B4. formatação e entrada em BTC", async () => {
    const { centsToInput, parseCurrencyToCents } = await import("@/lib/format");
    expect(formatCents(150_000, "BTC")).toBe("₿ 0,0015");
    expect(formatCents(100_000_000, "BTC")).toBe("₿ 1,00");
    expect(parseCurrencyToCents("0,0015", "BTC")).toBe(150_000);
    expect(parseCurrencyToCents("₿ 1", "BTC")).toBe(100_000_000);
    expect(parseCurrencyToCents("12,34")).toBe(1_234); // padrão continua centavos
    expect(centsToInput(150_000, "BTC")).toBe("0,0015");
    expect(centsToInput(123_456, "BRL")).toBe("1234,56");
  });
});
