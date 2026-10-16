import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cotações do dia (uma linha por par/dia). Nunca sobrescreve datas passadas.
 * A lógica fica em exchangeRates.server.ts para o sync reaproveitar.
 */
export const refreshExchangeRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { refreshLatestRates } = await import("@/lib/exchangeRates.server");
    return refreshLatestRates();
  });
