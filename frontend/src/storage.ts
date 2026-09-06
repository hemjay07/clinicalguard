// LocalStorage draft autosave for the authoring form, keyed by condition+subtype.
// Stores the editable form state (textarea strings) so a reload restores exactly
// what the author typed.
//
// Drafts live on one device, in one browser. That is the known limit of this
// mechanism: a case begun on a phone is not on the laptop, and clearing site
// data loses it. Making drafts follow the author is a server-side change; until
// then, listDrafts at least makes them findable where they were written.

const PREFIX = "cg_draft:";

export interface Draft<T> {
  state: T;
  savedAt: string;
  // Where the author was when they last typed, so resuming returns them to
  // the question they stopped on rather than to the top of the flow.
  screen?: string;
}

export interface DraftEntry<T> extends Draft<T> {
  slug: string;
}

// `slug` identifies the selection (e.g. the set of conditions+subtypes being authored).
export function saveDraft<T>(slug: string, state: T, screen?: string): string {
  const savedAt = new Date().toISOString();
  localStorage.setItem(PREFIX + slug, JSON.stringify({ state, savedAt, screen }));
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

// Every unfinished case on this device, newest first. Without this a draft was
// only reachable by its exact URL — an author who closed the tab had no way
// back to work they had already done, which is what physician feedback hit.
export function listDrafts<T>(): DraftEntry<T>[] {
  const out: DraftEntry<T>[] = [];
  let i = 0;
  for (; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "") as Draft<T>;
      if (parsed && parsed.state) out.push({ ...parsed, slug: key.slice(PREFIX.length) });
    } catch {
      /* corrupt entry — skip rather than break the whole list */
    }
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}
