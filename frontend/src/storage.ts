// LocalStorage draft autosave for the authoring form, keyed by condition+subtype.
// Stores the editable form state (textarea strings) so a reload restores exactly
// what the author typed.

const PREFIX = "cg_draft:";

export interface Draft<T> {
  state: T;
  savedAt: string;
}

// `slug` identifies the selection (e.g. the set of conditions+subtypes being authored).
export function saveDraft<T>(slug: string, state: T): string {
  const savedAt = new Date().toISOString();
  localStorage.setItem(PREFIX + slug, JSON.stringify({ state, savedAt }));
  return savedAt;
}

export function loadDraft<T>(slug: string): Draft<T> | null {
  const raw = localStorage.getItem(PREFIX + slug);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(slug: string): void {
  localStorage.removeItem(PREFIX + slug);
}
