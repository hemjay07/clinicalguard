// Unfinished cases, read from this device's localStorage drafts.
//
// Before this, a draft was reachable only by its exact URL: nothing in the app
// listed them, and the Cases page showed submitted cases only — so an author
// who closed the tab had no route back to work they had already done, and the
// Cases empty state told them "No cases yet" while their draft sat in storage.
// This is the index that was missing.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { listDrafts, clearDraft } from "../storage";
import type { DraftEntry } from "../storage";
import { encodeConditions, refsFromSlug } from "../selection";
import { screenSummary } from "../flow";
import type { FormState } from "../caseForm";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<DraftEntry<FormState>[]>([]);
  useEffect(() => { setDrafts(listDrafts<FormState>()); }, []);
  const remove = (slug: string) => {
    clearDraft(slug);
    setDrafts((d) => d.filter((x) => x.slug !== slug));
  };
  return { drafts, remove };
}

export function DraftList({ drafts, remove, heading = true }: {
  drafts: DraftEntry<FormState>[];
  remove: (slug: string) => void;
  heading?: boolean;
}) {
  // Names come from the conditions list, which is already cached — so a draft
  // written before this existed still shows a real condition name rather than
  // the numeric slug it was keyed by.
  const conditions = useConditionNames();

  if (drafts.length === 0) return null;

  return (
    <section>
      {heading && (
        <h2 className="cg-eyebrow">Unfinished, on this device</h2>
      )}
      <ul className="mt-2.5 space-y-2.5">
        {drafts.map((d) => {
          const refs = refsFromSlug(d.slug);
          // Back to the question they stopped on, not the top of the flow.
          const href = `/author/compose?conditions=${encodeConditions(refs)}`
            + (d.screen ? `&screen=${d.screen}` : "");
          const names = refs
            .map((r) => conditions[r.condition_id])
            .filter(Boolean)
            .join(", ");
          const scenario = screenSummary("query", d.state);
          const primary = d.state.primary?.trim();
          return (
            <li key={d.slug} className="cg-card px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={href}
                    className="block"
                  >
                    <span className="text-sm font-medium text-brand-700">
                      {names || `Case in progress`}
                    </span>
                    <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-neutral-800">
                      {scenario || primary || <span className="italic text-neutral-400">Nothing written yet</span>}
                    </p>
                    <span className="mt-1.5 block text-xs text-neutral-400">
                      Last edited {timeAgo(d.savedAt)}
                    </span>
                  </Link>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    to={href}
                    className="cg-btn-secondary px-3 py-1.5 text-xs"
                  >
                    Continue
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm("Discard this unfinished case? What you entered will be cleared.")) remove(d.slug);
                    }}
                    className="text-xs text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// id -> name, from the cached conditions list. Empty until it resolves; the
// list renders regardless, so a slow or failed fetch costs a label, never the
// route back to the draft.
function useConditionNames(): Record<number, string> {
  const [map, setMap] = useState<Record<number, string>>({});
  useEffect(() => {
    let cancelled = false;
    api.listConditions()
      .then((cs) => {
        if (cancelled) return;
        setMap(Object.fromEntries(cs.map((c) => [c.id, c.name])));
      })
      .catch(() => { /* label-only — the link still works */ });
    return () => { cancelled = true; };
  }, []);
  return map;
}
