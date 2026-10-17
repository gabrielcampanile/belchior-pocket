/**
 * Definição central de moedas do domínio financeiro.
 * Nenhum componente deve escrever strings de moeda ("BRL", "CAD"…) diretamente.
 */

export const CURRENCY_CODES = ["BRL", "CAD", "USD", "EUR", "ARS", "BTC"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "BRL";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  /** Sufixo/prefixo apenas informativo — a formatação real usa Intl.NumberFormat. */
  shortLabel: string;
  /**
   * Casas decimais da unidade mínima guardada no banco (`*_cents`): 2 nas moedas
   * fiduciárias (centavos), 8 no bitcoin (satoshis).
   */
  decimals: number;
  /** Cripto: não serve como moeda de visualização dos totais (gráficos, orçamento). */
  crypto?: boolean;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  BRL: { code: "BRL", name: "Real brasileiro", shortLabel: "R$", decimals: 2 },
  CAD: { code: "CAD", name: "Dólar canadense", shortLabel: "CA$", decimals: 2 },
  USD: { code: "USD", name: "Dólar americano", shortLabel: "US$", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", shortLabel: "€", decimals: 2 },
  ARS: { code: "ARS", name: "Peso argentino", shortLabel: "AR$", decimals: 2 },
  BTC: { code: "BTC", name: "Bitcoin", shortLabel: "₿", decimals: 8, crypto: true },
};

export const CURRENCY_LIST: CurrencyMeta[] = CURRENCY_CODES.map((code) => CURRENCIES[code]);

/** Moedas oferecidas como moeda de visualização (sem cripto). */
export const DISPLAY_CURRENCY_LIST: CurrencyMeta[] = CURRENCY_LIST.filter((c) => !c.crypto);

/** Unidades mínimas por unidade: 100 para centavos, 100.000.000 para satoshis. */
export function minorUnitFactor(currency: CurrencyCode): number {
  return 10 ** CURRENCIES[currency].decimals;
}

/** Valor monetário sempre em centavos inteiros + a moeda original. */
export interface Money {
  amountCents: number;
  currency: CurrencyCode;
}

export function money(amountCents: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  return { amountCents: Math.round(amountCents), currency };
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Converte um valor vindo do banco/CSV em uma moeda válida, caindo no default quando desconhecido. */
export function toCurrencyCode(
  value: unknown,
  fallback: CurrencyCode = DEFAULT_CURRENCY,
): CurrencyCode {
  if (typeof value !== "string") return fallback;
  const upper = value.trim().toUpperCase();
  return isCurrencyCode(upper) ? upper : fallback;
}

export function isSameCurrency(a: Money, b: Money): boolean {
  return a.currency === b.currency;
}
