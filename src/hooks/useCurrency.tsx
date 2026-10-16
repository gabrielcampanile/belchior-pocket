import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { refreshExchangeRates } from "@/lib/exchangeRates.functions";

import {
  DEFAULT_CURRENCY,
  money,
  toCurrencyCode,
  type CurrencyCode,
  type Money,
} from "@/domain/currency";
import {
  convertMoney,
  createConverter,
  type ExchangeRate,
  type MoneyConverter,
} from "@/domain/exchange";
import { fetchExchangeRates } from "@/lib/exchangeRateService";
import { formatCents } from "@/lib/format";
import { useSession } from "@/hooks/useSession";

const RATES_SYNC_KEY = "belchior:rates-sync";
const DISPLAY_CURRENCY_KEY = "belchior:display-currency";

interface CurrencyContextValue {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
  isUpdating: boolean;
  rates: ExchangeRate[];
  /** Converte para a moeda de visualização e devolve centavos. */
  convert: MoneyConverter;
  /** Formata já convertido para a moeda de visualização. */
  formatDisplay: (value: Money, onDate?: string) => string;
  /** true quando o valor precisou de conversão. */
  isConverted: (value: Money) => boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/** Cotações: uma única query, cache longo — nunca buscadas durante render. */
export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: fetchExchangeRates,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { data: rates = [] } = useExchangeRates();
  const queryClient = useQueryClient();

  // v1 é single-user: a moeda de visualização é preferência local, não fica no banco.
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDisplayCurrencyState(
      toCurrencyCode(window.localStorage.getItem(DISPLAY_CURRENCY_KEY), DEFAULT_CURRENCY),
    );
  }, []);

  // Atualiza as cotações uma vez por dia, ao entrar na plataforma.
  const refresh = useServerFn(refreshExchangeRates);
  useEffect(() => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(RATES_SYNC_KEY) === today) return;
    window.localStorage.setItem(RATES_SYNC_KEY, today);
    void refresh()
      .then(() => queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }))
      .catch(() => window.localStorage.removeItem(RATES_SYNC_KEY));
  }, [session, refresh, queryClient]);

  const mutation = useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
      }
      setDisplayCurrencyState(currency);
    },
  });

  const convert = useMemo(() => createConverter(displayCurrency, rates), [displayCurrency, rates]);

  const formatDisplay = useCallback(
    (value: Money, onDate?: string) =>
      formatCents(
        convertMoney(value, displayCurrency, rates, onDate)?.amountCents ?? value.amountCents,
        displayCurrency,
      ),
    [displayCurrency, rates],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      displayCurrency,
      setDisplayCurrency: (currency: CurrencyCode) => mutation.mutate(currency),
      isUpdating: mutation.isPending,
      rates,
      convert,
      formatDisplay,
      isConverted: (m: Money) => m.currency !== displayCurrency,
    }),
    [displayCurrency, mutation, rates, convert, formatDisplay],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  // Fallback seguro fora do provider (ex.: telas públicas).
  return {
    displayCurrency: DEFAULT_CURRENCY,
    setDisplayCurrency: () => {},
    isUpdating: false,
    rates: [],
    convert: (m) => m.amountCents,
    formatDisplay: (m) => formatCents(m.amountCents, m.currency),
    isConverted: () => false,
  };
}

/** Helper de conveniência para montar Money a partir de linhas do banco. */
export function rowMoney(amountCents: number, currency: unknown): Money {
  return money(amountCents, toCurrencyCode(currency));
}
