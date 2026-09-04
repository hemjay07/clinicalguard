// Which of the two authoring views is active — guided (default) or the full
// form. It lives here rather than in the Authoring page because the switch has
// two homes: the in-card row on desktop, and the nav hamburger on a phone,
// where the header has no room for it. Both write here; the page subscribes.
//
// The preference persists across sessions, as it always has.

export type ViewMode = "guided" | "form";

const KEY = "cg_author_view";
const EVENT = "cg:author-view";

export function getAuthorView(): ViewMode {
  try {
    return localStorage.getItem(KEY) === "form" ? "form" : "guided";
  } catch {
    return "guided";
  }
}

export function setAuthorView(v: ViewMode): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private mode — the switch still works for this session */
  }
  window.dispatchEvent(new CustomEvent<ViewMode>(EVENT, { detail: v }));
}

export function subscribeAuthorView(fn: (v: ViewMode) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<ViewMode>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
