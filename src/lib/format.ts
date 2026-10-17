/**
 * Formatação pt-BR multimoeda. Valores monetários são sempre inteiros na unidade mínima da
 * moeda (centavos; satoshis no BTC) — ver `CURRENCIES[code].decimals`.
 */

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  minorUnitFactor,
  type CurrencyCode,
  type Money,
} from "@/domain/currency";

const LOCALE = "pt-BR";

const cache = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let f = cache.get(key);
  if (!f) {
    const decimals = CURRENCIES[currency].decimals;
    f = CURRENCIES[currency].crypto
      ? // Intl has no symbol for BTC: plain number, the ₿ prefix is added below.
        new Intl.NumberFormat(LOCALE, {
          minimumFractionDigits: compact ? 0 : Math.min(decimals, 2),
          maximumFractionDigits: compact ? 4 : decimals,
        })
      : new Intl.NumberFormat(LOCALE, {
          style: "currency",
          currency,
          minimumFractionDigits: compact ? 0 : decimals,
          maximumFractionDigits: compact ? 0 : decimals,
        });
    cache.set(key, f);
  }
  return f;
}

function format(minor: number, currency: CurrencyCode, compact: boolean): string {
  const text = formatter(currency, compact).format((minor ?? 0) / minorUnitFactor(currency));
  return CURRENCIES[currency].crypto ? `${CURRENCIES[currency].shortLabel} ${text}` : text;
}

export function formatCents(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return format(cents, currency, false);
}

export function formatCentsShort(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return format(cents, currency, true);
}

/** Formatação canônica de um valor de domínio. */
export function formatMoney(value: Money): string {
  return formatCents(value.amountCents, value.currency);
}

export function formatMoneyShort(value: Money): string {
  return formatCentsShort(value.amountCents, value.currency);
}

/** Valor convertido, sempre marcado com "≈" para deixar claro que não é o original. */
export function formatApprox(cents: number, currency: CurrencyCode): string {
  return `≈ ${formatCents(cents, currency)}`;
}

export function formatSignedCents(
  cents: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  const s = formatCents(Math.abs(cents), currency);
  if (cents > 0) return `+${s}`;
  if (cents < 0) return `−${s}`;
  return s;
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Converte texto digitado pelo usuário ("1.234,56", "1234.56", "R$ 100", "₿ 0,0015") na
 * unidade mínima de `currency` (centavos por padrão; satoshis no BTC).
 */
export function parseCurrencyToCents(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number | null {
  if (input == null) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  raw = raw.replace(/[R$₿\s\u00a0]/gi, "");
  const negative = /^-/.test(raw) || /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()-]/g, "");
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  if (hasComma && hasDot) {
    // o último separador é o decimal
    raw =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (hasComma) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const minor = Math.round(value * minorUnitFactor(currency));
  return negative ? -minor : minor;
}

export function centsToInput(
  cents: number | null | undefined,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  if (cents == null) return "";
  const decimals = CURRENCIES[currency].decimals;
  return (cents / minorUnitFactor(currency)).toLocaleString(LOCALE, {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
}
