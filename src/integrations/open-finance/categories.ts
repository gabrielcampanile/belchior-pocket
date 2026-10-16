/**
 * Pluggy category -> user category resolution. PURE (no I/O).
 *
 * The sync groups transactions by the TOP-LEVEL Pluggy category ('17030000' -> '17000000'),
 * which gives ~20 readable buckets (Mercado, Transporte, Moradia...) instead of ~100 leaves.
 * The first time a group shows up for a kind (INCOME/EXPENSE), the sync creates a user
 * category named after the group's Portuguese label and a mapping row pointing to it.
 * From then on only the mapping is read, so the user can rename, merge or remap freely.
 *
 * Only INCOME and EXPENSE transactions get a category. Transfers between own accounts,
 * investment contributions and card-bill payments are not spending and stay uncategorized.
 */

import type { CanonicalTxType } from "./adapter";
import type { PluggyCategory } from "./pluggy.types";

export type CategoryKind = "INCOME" | "EXPENSE";

/** Pluggy ids are 8 digits; the first two identify the top-level group. */
export function topLevelCategoryId(providerCategoryId: string): string {
  return /^\d{8}$/.test(providerCategoryId)
    ? `${providerCategoryId.slice(0, 2)}000000`
    : providerCategoryId;
}

export function categoryKindFor(type: CanonicalTxType): CategoryKind | null {
  if (type === "INCOME") return "INCOME";
  if (type === "EXPENSE") return "EXPENSE";
  return null;
}

/** Fallback bucket when Pluggy sent no category at all. */
export const UNCATEGORIZED_PROVIDER_ID = "__none__";
const UNCATEGORIZED_LABEL = "Outros";

/** Portuguese label for a top-level group; falls back to the English one, then "Outros". */
export function categoryLabel(topLevelId: string, catalog: ReadonlyMap<string, PluggyCategory>) {
  if (topLevelId === UNCATEGORIZED_PROVIDER_ID) return UNCATEGORIZED_LABEL;
  const entry = catalog.get(topLevelId);
  const label = entry?.descriptionTranslated?.trim() || entry?.description?.trim();
  return label || UNCATEGORIZED_LABEL;
}

export const mappingKey = (kind: CategoryKind, providerCategoryId: string) =>
  `${kind}:${providerCategoryId}`;
export const nameKey = (kind: CategoryKind, name: string) =>
  `${kind}:${name.trim().toLocaleLowerCase("pt-BR")}`;

export interface NeededGroup {
  kind: CategoryKind;
  providerCategoryId: string; // top-level
}

export interface CategoryResolutionPlan {
  /** Categories to create (deduplicated by kind + name). */
  categoriesToCreate: { kind: CategoryKind; name: string }[];
  /** Mappings to create; `name` is the category (existing or new) the group points to. */
  mappingsToCreate: { kind: CategoryKind; providerCategoryId: string; name: string }[];
}

/**
 * Decide what to create for the groups seen in this sync.
 *  - group already mapped -> nothing;
 *  - unmapped, but the user already has a category with the label's name -> map to it;
 *  - otherwise -> create the category and map to it.
 */
export function planCategoryResolution(
  needed: NeededGroup[],
  existingMappings: ReadonlySet<string>, // mappingKey
  existingCategoryNames: ReadonlySet<string>, // nameKey
  catalog: ReadonlyMap<string, PluggyCategory>,
): CategoryResolutionPlan {
  const categoriesToCreate: CategoryResolutionPlan["categoriesToCreate"] = [];
  const mappingsToCreate: CategoryResolutionPlan["mappingsToCreate"] = [];
  const plannedNames = new Set<string>();
  const plannedMappings = new Set<string>();

  for (const group of needed) {
    const mKey = mappingKey(group.kind, group.providerCategoryId);
    if (existingMappings.has(mKey) || plannedMappings.has(mKey)) continue;
    plannedMappings.add(mKey);

    const name = categoryLabel(group.providerCategoryId, catalog);
    const nKey = nameKey(group.kind, name);
    if (!existingCategoryNames.has(nKey) && !plannedNames.has(nKey)) {
      plannedNames.add(nKey);
      categoriesToCreate.push({ kind: group.kind, name });
    }
    mappingsToCreate.push({ kind: group.kind, providerCategoryId: group.providerCategoryId, name });
  }

  return { categoriesToCreate, mappingsToCreate };
}
