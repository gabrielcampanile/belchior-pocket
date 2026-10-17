import {
  DEFAULT_CURRENCY,
  minorUnitFactor,
  money,
  type CurrencyCode,
  type Money,
} from "./currency";

/**
 * Câmbio: funções puras e determinísticas.
 * `rate` significa: 1 unidade de `base` = `rate` unidades de `quote`.
 * As cotações são históricas — a conversão de uma data usa a cotação vigente naquela data.
 */

export interface ExchangeRate {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  /** ISO date (YYYY-MM-DD) a partir da qual a cotação vale. */
  effectiveOn: string;
  source: string;
}

/** Moeda "pivô" usada para triangulação quando não existe par direto. */
const PIVOT: CurrencyCode = DEFAULT_CURRENCY;

function latestBefore(
  rates: ExchangeRate[],
  base: CurrencyCode,
  quote: CurrencyCode,
  onDate?: string,
): ExchangeRate | null {
  let best: ExchangeRate | null = null;
  for (const r of rates) {
    if (r.base !== base || r.quote !== quote) continue;
    if (onDate && r.effectiveOn > onDate) continue;
    if (!best || r.effectiveOn > best.effectiveOn) best = r;
  }
  if (best) return best;
  // Nenhuma cotação anterior à data: usa a mais antiga conhecida do par.
  let oldest: ExchangeRate | null = null;
  for (const r of rates) {
    if (r.base !== base || r.quote !== quote) continue;
    if (!oldest || r.effectiveOn < oldest.effectiveOn) oldest = r;
  }
  return oldest;
}

/**
 * Taxa base→quote vigente em `onDate`.
 * Ordem: identidade → par direto → par invertido → triangulação via moeda pivô.
 */
export function findRate(
  rates: ExchangeRate[],
  base: CurrencyCode,
  quote: CurrencyCode,
  onDate?: string,
): number | null {
  if (base === quote) return 1;

  const direct = latestBefore(rates, base, quote, onDate);
  if (direct) return direct.rate;

  const inverse = latestBefore(rates, quote, base, onDate);
  if (inverse && inverse.rate !== 0) return 1 / inverse.rate;

  if (base !== PIVOT && quote !== PIVOT) {
    const baseToPivot = findRate(rates, base, PIVOT, onDate);
    const pivotToQuote = findRate(rates, PIVOT, quote, onDate);
    if (baseToPivot != null && pivotToQuote != null) return baseToPivot * pivotToQuote;
  }

  return null;
}

/**
 * Converte um valor monetário preservando o original (retorna sempre um novo Money).
 * Retorna `null` quando não há cotação disponível para o par.
 */
export function convertMoney(
  value: Money,
  target: CurrencyCode,
  rates: ExchangeRate[],
  onDate?: string,
): Money | null {
  if (value.currency === target) return money(value.amountCents, target);
  const rate = findRate(rates, value.currency, target, onDate);
  if (rate == null) return null;
  // Rates are per WHOLE unit; amounts are minor units with per-currency decimals
  // (centavos vs satoshis), so rescale between the two minor units.
  const scale = minorUnitFactor(target) / minorUnitFactor(value.currency);
  return money(value.amountCents * rate * scale, target);
}

/** Conversor pronto para a camada de apresentação/agregação. */
export type MoneyConverter = (value: Money, onDate?: string) => number;

export function createConverter(target: CurrencyCode, rates: ExchangeRate[]): MoneyConverter {
  return (value, onDate) =>
    convertMoney(value, target, rates, onDate)?.amountCents ?? rescaleMinor(value, target);
}

/**
 * Fallback when no rate is known: keep the number but move it to the target's minor unit,
 * so a missing BTC rate can never add satoshis to a BRL total as if they were centavos.
 */
export function rescaleMinor(value: Money, target: CurrencyCode): number {
  return Math.round(
    (value.amountCents * minorUnitFactor(target)) / minorUnitFactor(value.currency),
  );
}

/** Conversor neutro: mantém o valor como está (usado quando não há multimoeda em jogo). */
export const identityConverter: MoneyConverter = (value) => value.amountCents;

/** Soma multimoeda: converte cada item ANTES de agregar. */
export function sumMoney(
  values: Money[],
  target: CurrencyCode,
  rates: ExchangeRate[],
  onDate?: string,
): Money {
  let total = 0;
  for (const v of values) {
    const converted = convertMoney(v, target, rates, onDate);
    if (converted) total += converted.amountCents;
  }
  return money(total, target);
}
