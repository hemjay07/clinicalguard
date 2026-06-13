// LocalStorage draft autosave for the authoring form, keyed by condition+subtype.
// Stores the editable form state (textarea strings) so a reload restores exactly
// what the author typed.

const PREFIX = "cg_draft:";

export interface Draft<T> {
  state: T;
  savedAt: string;
}

function key(conditionId: number, subtype: string | null): string {
  return `${PREFIX}${conditionId}:${subtype ?? ""}`;
}

export function saveDraft<T>(conditionId: number, subtype: string | null, state: T): string {
  const savedAt = new Date().toISOString();
  localStorage.setItem(key(conditionId, subtype), JSON.stringify({ state, savedAt }));
  return savedAt;
}

export function loadDraft<T>(conditionId: number, subtype: string | null): Draft<T> | null {
  const raw = localStorage.getItem(key(conditionId, subtype));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(conditionId: number, subtype: string | null): void {
  localStorage.removeItem(key(conditionId, subtype));
}
