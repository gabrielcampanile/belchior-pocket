/**
 * "Esconder valores" (o olho do app do banco): quando ligado, todo valor monetário formatado
 * por `@/lib/format` vira "R$ ••••". A escolha fica no aparelho (localStorage), então quem
 * esconde no escritório reabre o app já escondido.
 *
 * O estado mora num módulo (não num contexto) porque os formatadores são funções puras chamadas
 * em todo lugar. Telas que formatam valores assinam com `useHideValues()` para re-renderizar
 * quando o estado muda.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "belchior:hide-values";

let hidden = readStored();
const listeners = new Set<() => void>();

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Lido pelos formatadores. */
export function valuesHidden(): boolean {
  return hidden;
}

export function setValuesHidden(next: boolean): void {
  if (next === hidden) return;
  hidden = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Safari em modo privado pode recusar: o estado vale só para esta aba.
    }
  }
  listeners.forEach((l) => l());
}

export function toggleValuesHidden(): void {
  setValuesHidden(!hidden);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renderiza o componente quando os valores são escondidos ou mostrados. */
export function useHideValues(): boolean {
  return useSyncExternalStore(subscribe, valuesHidden, () => false);
}
