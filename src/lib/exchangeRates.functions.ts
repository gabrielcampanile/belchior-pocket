import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cotações do dia (uma linha por par/dia). Nunca sobrescreve datas passadas.
 * A lógica fica em exchangeRates.server.ts para o sync reaproveitar.
 */
export const refreshExchangeRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { refreshLatestRates, refreshBtcRate } = await import("@/lib/exchangeRates.server");
    const fiat = await refreshLatestRates();
    // Bitcoin is a separate source; its failure must not hide the fiat refresh.
    let btc = true;
    try {
      await refreshBtcRate();
    } catch (err) {
      btc = false;
      console.error("[rates] bitcoin failed:", err instanceof Error ? err.message : err);
    }
    return { ...fiat, btc };
  });
