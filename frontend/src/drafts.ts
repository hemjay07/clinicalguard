// Client half of server-side drafts (ADR-034).
//
// The server row is the source of truth: a case begun on a phone is on the
// laptop, and clearing site data no longer destroys work. localStorage is
// demoted to a crash buffer — it catches the seconds between a keystroke and
// the debounced PUT that follows, and it is discarded as soon as the server
// has caught up.
//
// Draft identity is minted by the client so a draft keeps one id across
// debounced saves, and across a reload that lands before the first response.

import { api } from "./api/client";
import { loadDraft, saveDraft, clearDraft, listDrafts } from "./storage";
import { refsFromSlug } from "./selection";
import type { CaseDraftDto, ConditionRef } from "./types";
import type { FormState } from "./caseForm";

export const BUFFER_PREFIX = "buf:";
const LEGACY_MIGRATED_KEY = "cg_drafts_migrated_v17";

export function mintDraftId(): string {
  // randomUUID needs a secure context; the fallback keeps local http dev and
  // any older mobile browser working rather than throwing mid-authoring.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// --- crash buffer -------------------------------------------------------------
// Keyed by draft id, not by condition set, so it lines up with the server row.

export function writeBuffer(draftId: string, state: FormState, screen: string): string {
  return saveDraft(BUFFER_PREFIX + draftId, state, screen);
}

export function readBuffer(draftId: string) {
  return loadDraft<FormState>(BUFFER_PREFIX + draftId);
}

export function dropBuffer(draftId: string): void {
  clearDraft(BUFFER_PREFIX + draftId);
}

// The buffer only wins when it is genuinely ahead of the server — i.e. the tab
// died between a keystroke and its PUT. Otherwise the server copy stands, which
// is what makes another device's edits authoritative here.
export function bufferIsAhead(draftId: string, serverUpdatedAt: string | null): boolean {
  const buf = readBuffer(draftId);
  if (!buf) return false;
  if (!serverUpdatedAt) return true;
  return new Date(buf.savedAt).getTime() > new Date(serverUpdatedAt).getTime() + 1000;
}

// --- legacy local drafts ------------------------------------------------------

// Drafts written before v1.7 sit in localStorage under the old condition-keyed
// scheme, and nothing lists those any more. Push them up once, so an author
// mid-case when this shipped does not watch their work disappear from the list.
// Runs at most once per browser; a failure leaves the local copy alone so the
// next load can retry.
export async function migrateLegacyDrafts(): Promise<number> {
  try {
    if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return 0;
  } catch {
    return 0; // storage unavailable — nothing to migrate from
  }

  const legacy = listDrafts<FormState>().filter((d) => !d.slug.startsWith(BUFFER_PREFIX));
  if (legacy.length === 0) {
    try { localStorage.setItem(LEGACY_MIGRATED_KEY, "1"); } catch { /* non-fatal */ }
    return 0;
  }

  let moved = 0;
  for (const d of legacy) {
    const refs = refsFromSlug(d.slug);
    try {
      await api.saveDraft(mintDraftId(), {
        condition_ids: refs,
        form_state: d.state,
        screen_id: d.screen ?? null,
      });
      clearDraft(d.slug);
      moved++;
    } catch {
      // Leave it in place; the next load tries again.
    }
  }
  if (moved === legacy.length) {
    try { localStorage.setItem(LEGACY_MIGRATED_KEY, "1"); } catch { /* non-fatal */ }
  }
  return moved;
}

// --- reading the list ---------------------------------------------------------

export interface UnfinishedCase {
  id: string;
  refs: ConditionRef[];
  state: FormState;
  screenId: string | null;
  updatedAt: string;
}

export function toUnfinished(d: CaseDraftDto): UnfinishedCase {
  return {
    id: d.id,
    refs: d.condition_ids ?? [],
    state: d.form_state as unknown as FormState,
    screenId: d.screen_id,
    updatedAt: d.updated_at,
  };
}
