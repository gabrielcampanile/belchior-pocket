/**
 * Exchange rates — SERVER ONLY (writes with the service role; the table is global and
 * read-only for authenticated users).
 *
 * Two sources:
 *  - open.er-api.com: today's rate for every supported currency (incl. ARS). Daily refresh.
 *  - Frankfurter (ECB): historical daily rates, used once to backfill the past so a CAD
 *    expense from March converts at March's rate. ECB has no ARS: ARS history falls back
 *    to the oldest known rate (see domain/exchange.ts latestBefore).
 * Rows are never overwritten for past dates: the history stays immutable.
 */

import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/domain/currency";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LATEST_SOURCE = "open.er-api.com";
const HISTORY_SOURCE = "frankfurter.dev (ECB)";
const TIMEOUT_MS = 20_000;
const HISTORY_CURRENCIES: CurrencyCode[] = ["CAD", "USD", "EUR"];

type RateRow = {
  base_currency: "BRL";
  quote_currency: CurrencyCode;
  rate: number;
  effective_on: string;
  source: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function insertRates(rows: RateRow[], overwrite: boolean) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from("exchange_rates").upsert(rows.slice(i, i + 500), {
      onConflict: "base_currency,quote_currency,effective_on",
      ignoreDuplicates: !overwrite,
    });
    if (error) throw new Error(error.message);
  }
}

/** Today's BRL-based rates. No-op when today's rows already exist. */
export async function refreshLatestRates() {
  const effectiveOn = today();
  const { data: existing } = await supabaseAdmin
    .from("exchange_rates")
    .select("id")
    .eq("effective_on", effectiveOn)
    .eq("source", LATEST_SOURCE)
    .limit(1);
  if (existing && existing.length > 0) return { updated: false, effectiveOn, pairs: 0 };

  const response = await fetch("https://open.er-api.com/v6/latest/BRL", {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Fonte de cotações indisponível.");
  const rates = ((await response.json()) as { rates?: Record<string, number> }).rates ?? {};

  const rows: RateRow[] = CURRENCY_CODES.filter(
    (code) => code !== "BRL" && !CURRENCIES[code].crypto && Number.isFinite(rates[code]),
  ).map((code) => ({
    base_currency: "BRL",
    quote_currency: code,
    rate: rates[code],
    effective_on: effectiveOn,
    source: LATEST_SOURCE,
  }));
  if (rows.length === 0) throw new Error("Nenhuma cotação retornada pela fonte.");

  await insertRates(rows, true);
  return { updated: true, effectiveOn, pairs: rows.length };
}

// --- Bitcoin (CoinGecko) ------------------------------------------------------------

const BTC_SOURCE = "coingecko";
const COINGECKO = "https://api.coingecko.com/api/v3";
/** CoinGecko's free API serves at most this many days of daily history. */
const BTC_MAX_HISTORY_DAYS = 365;

/** BRL price of 1 BTC -> our BRL-based rate (1 BRL = rate BTC). */
function btcRow(priceBrl: number, effectiveOn: string): RateRow | null {
  if (!Number.isFinite(priceBrl) || priceBrl <= 0) return null;
  return {
    base_currency: "BRL",
    quote_currency: "BTC",
    rate: 1 / priceBrl,
    effective_on: effectiveOn,
    source: BTC_SOURCE,
  };
}

/**
 * Today's BTC rate, fetched on EVERY call (unlike fiat): bitcoin moves during the day, so
 * each sync/refresh overwrites today's row with the price of the moment.
 */
export async function refreshBtcRate() {
  const response = await fetch(`${COINGECKO}/simple/price?ids=bitcoin&vs_currencies=brl`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Cotação do bitcoin indisponível.");
  const payload = (await response.json()) as { bitcoin?: { brl?: number } };
  const row = btcRow(Number(payload.bitcoin?.brl), today());
  if (!row) throw new Error("Cotação do bitcoin inválida.");
  await insertRates([row], true);
  return { updated: true, effectiveOn: row.effective_on };
}

/** Daily BTC history back to `fromDate` (capped at CoinGecko's free 365 days). Runs once. */
export async function backfillBtcSince(fromDate: string) {
  const { data: oldest } = await supabaseAdmin
    .from("exchange_rates")
    .select("effective_on")
    .eq("base_currency", "BRL")
    .eq("quote_currency", "BTC")
    .order("effective_on", { ascending: true })
    .limit(1);
  const oldestOn = oldest?.[0]?.effective_on ? String(oldest[0].effective_on) : null;
  if (oldestOn && oldestOn <= fromDate) return { inserted: 0 };

  const spanDays = Math.ceil((Date.now() - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000) + 1;
  const days = Math.min(BTC_MAX_HISTORY_DAYS, Math.max(1, spanDays));
  const url = new URL(`${COINGECKO}/coins/bitcoin/market_chart`);
  url.searchParams.set("vs_currency", "brl");
  url.searchParams.set("days", String(days));
  url.searchParams.set("interval", "daily");
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error("Histórico do bitcoin indisponível.");
  const payload = (await response.json()) as { prices?: [number, number][] };

  const byDay = new Map<string, RateRow>();
  for (const [ms, price] of payload.prices ?? []) {
    const day = new Date(ms).toISOString().slice(0, 10);
    const row = btcRow(price, day);
    if (row) byDay.set(day, row); // last point of the day wins
  }
  const rows = [...byDay.values()];
  // Never overwrite stored days: history stays immutable (today is refreshed separately).
  await insertRates(rows, false);
  return { inserted: rows.length };
}

/**
 * Make sure there are historical rates back to `fromDate` (YYYY-MM-DD). Fetches only the
 * missing span before the oldest stored rate, so it runs once and then is a cheap check.
 */
export async function backfillRatesSince(fromDate: string) {
  const { data: oldest } = await supabaseAdmin
    .from("exchange_rates")
    .select("effective_on")
    .eq("base_currency", "BRL")
    // Only the currencies this backfill serves: BTC history must not mask a fiat gap.
    .in("quote_currency", HISTORY_CURRENCIES)
    .order("effective_on", { ascending: true })
    .limit(1);
  const oldestOn = oldest?.[0]?.effective_on ? String(oldest[0].effective_on) : null;
  if (oldestOn && oldestOn <= fromDate) return { inserted: 0 };

  const until = oldestOn ? dayBefore(oldestOn) : today();
  if (until < fromDate) return { inserted: 0 };

  const url = new URL(`https://api.frankfurter.dev/v1/${fromDate}..${until}`);
  url.searchParams.set("base", "BRL");
  url.searchParams.set("symbols", HISTORY_CURRENCIES.join(","));
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error("Fonte de cotações históricas indisponível.");
  const payload = (await response.json()) as {
    rates?: Record<string, Partial<Record<CurrencyCode, number>>>;
  };

  const rows: RateRow[] = [];
  for (const [effectiveOn, byCurrency] of Object.entries(payload.rates ?? {})) {
    for (const code of HISTORY_CURRENCIES) {
      const rate = byCurrency[code];
      if (Number.isFinite(rate)) {
        rows.push({
          base_currency: "BRL",
          quote_currency: code,
          rate: rate as number,
          effective_on: effectiveOn,
          source: HISTORY_SOURCE,
        });
      }
    }
  }
  await insertRates(rows, false);
  return { inserted: rows.length };
}
