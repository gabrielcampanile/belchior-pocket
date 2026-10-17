import { supabase } from "@/integrations/supabase/client";
import { toCurrencyCode } from "@/domain/currency";
import type { ExchangeRate } from "@/domain/exchange";

/**
 * Camada isolada de cotações. A fonte pode ser trocada sem tocar no domínio.
 * Leitura: tabela `exchange_rates` (RLS: leitura para usuários autenticados).
 * Escrita: apenas o servidor (`refreshExchangeRates`).
 */
/**
 * PostgREST caps every response at the project's max-rows (1000 on Supabase), whatever
 * `.limit()` asks for. The table outgrew that (fiat history + BTC), and with an ascending
 * order the cut dropped the NEWEST rows -- ARS only has recent rates, so ARS amounts fell
 * through to the no-rate fallback and were summed 1:1 as reais. Page until a short page.
 */
const PAGE_SIZE = 1000;

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("exchange_rates")
      .select("base_currency, quote_currency, rate, effective_on, source")
      .order("effective_on", { ascending: true })
      // Tie-breaker: a stable total order so pages never overlap or skip rows.
      .order("quote_currency", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows.map((row) => ({
    base: toCurrencyCode(row.base_currency),
    quote: toCurrencyCode(row.quote_currency),
    rate: Number(row.rate),
    effectiveOn: String(row.effective_on),
    source: String(row.source ?? "unknown"),
  }));
}
