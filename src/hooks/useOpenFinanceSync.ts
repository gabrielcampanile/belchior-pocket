import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { syncOpenFinance, syncOpenFinanceIfStale } from "@/lib/openFinance.functions";
import { useSession } from "@/hooks/useSession";

/** Every query that reads Open Finance data lives under this key prefix. */
export const OPEN_FINANCE_QUERY_KEY = ["open-finance"] as const;

// AppLayout remounts on every navigation; the auto-sync must run once per page load.
let autoSyncStarted = false;

type SyncResponse = Awaited<ReturnType<typeof syncOpenFinance>>;

function failedItems(result: SyncResponse) {
  return result.items.filter((i) => i.status !== "success" && i.status !== "skipped_running");
}

/** On app open, sync if the last sync is older than a few hours (decided by the server). */
export function useAutoSync() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const syncIfStale = useServerFn(syncOpenFinanceIfStale);

  useEffect(() => {
    if (!session || autoSyncStarted) return;
    autoSyncStarted = true;
    void syncIfStale()
      .then((result) => {
        if (result.skipped) return;
        void queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
        if (failedItems(result).length > 0) {
          toast.error("Algumas conexões não sincronizaram. Veja em Conexões.");
        }
      })
      .catch(() => {
        // Silent on open: the Conexões screen shows the error and has the manual button.
        autoSyncStarted = false;
      });
  }, [session, syncIfStale, queryClient]);
}

/** "Sincronizar agora". */
export function useSyncNow() {
  const queryClient = useQueryClient();
  const sync = useServerFn(syncOpenFinance);

  return useMutation({
    mutationFn: () => sync(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: OPEN_FINANCE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      const failed = failedItems(result);
      const upserted = result.items.reduce((n, i) => n + i.transactionsUpserted, 0);
      if (failed.length > 0) {
        toast.error(`${failed.map((i) => i.institution).join(", ")}: falha na sincronização.`);
      } else if (result.items.every((i) => i.status === "skipped_running")) {
        toast.info("Já existe uma sincronização em andamento.");
      } else {
        toast.success(
          upserted > 0
            ? `Sincronizado: ${upserted} transações novas ou atualizadas.`
            : "Tudo em dia.",
        );
      }
      if (result.ratesError) toast.warning(result.ratesError);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao sincronizar.");
    },
  });
}
