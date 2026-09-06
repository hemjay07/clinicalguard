// Encoding for the selected conditions: passed in the authoring route URL
// (refresh-safe) and used to key the localStorage draft.

import type { ConditionRef } from "./types";

export function encodeConditions(refs: ConditionRef[]): string {
  return encodeURIComponent(JSON.stringify(refs.map((r) => ({ condition_id: r.condition_id, subtype: r.subtype ?? null }))));
}

export function decodeConditions(s: string | null): ConditionRef[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(s));
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => typeof x?.condition_id === "number")
        .map((x) => ({ condition_id: x.condition_id, subtype: x.subtype ?? null }));
    }
  } catch {
    /* malformed param — treat as empty */
  }
  return [];
}

// Order-independent key for the draft autosave.
export function draftSlug(refs: ConditionRef[]): string {
  return refs
    .map((r) => `${r.condition_id}:${r.subtype ?? ""}`)
    .sort()
    .join("|");
}

// Inverse of draftSlug, for reading drafts written under the pre-v1.7
// condition-keyed scheme during the one-time migration to server drafts.
export function refsFromSlug(slug: string): ConditionRef[] {
  if (!slug) return [];
  return slug.split("|").map((part) => {
    const [id, subtype] = part.split(":");
    return { condition_id: Number(id), subtype: subtype || null };
  }).filter((r) => Number.isFinite(r.condition_id));
}
