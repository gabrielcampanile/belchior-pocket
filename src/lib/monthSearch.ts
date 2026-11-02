import { currentMonthKey, type MonthKey } from "@/lib/months";

/** Mês na URL: `?mes=2026-06`. Inválido ou no futuro vira o mês atual. */
export interface MonthSearch {
  mes?: string;
}

export function validateMonthSearch(search: Record<string, unknown>): MonthSearch {
  const raw = search.mes;
  return typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? { mes: raw } : {};
}

export function monthFromSearch(mes: string | undefined): MonthKey {
  const current = currentMonthKey();
  if (!mes) return current;
  const key = `${mes}-01`;
  return key > current ? current : key;
}

/** O mês atual some da URL, para o link da navegação continuar limpo. */
export function monthToSearch(month: MonthKey): MonthSearch {
  return month === currentMonthKey() ? {} : { mes: month.slice(0, 7) };
}
