// Unfinished cases, read from the server (ADR-034).
//
// Before v1.6 a draft was reachable only by its exact URL: nothing in the app
// listed them, and Cases showed submitted cases only, so an author who closed
// the tab had no route back to work they had already done. v1.6 added this list
// over localStorage; v1.7 moved the store to the server, so the list is now the
// same on every device the author signs in on.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { migrateLegacyDrafts, dropBuffer, toUnfinished } from "../drafts";
import type { UnfinishedCase } from "../drafts";
import { encodeConditions } from "../selection";
import { screenSummary } from "../flow";

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
  const [drafts, setDrafts] = useState<UnfinishedCase[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      // Anything still sitting in the old local store is pushed up first, so a
      // case begun before v1.7 appears in this list rather than vanishing.
      await migrateLegacyDrafts();
      const rows = await api.listDrafts();
      setDrafts(rows.map(toUnfinished));
    } catch {
      // Signed out, or the backend is still waking. This list is additive, so
      // an empty one costs the author nothing a failed page would not.
      setDrafts([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    setDrafts((d) => d.filter((x) => x.id !== id));
    dropBuffer(id);
    try {
      await api.deleteDraft(id);
    } catch {
      load(); // put it back if the server disagreed
    }
  };

  return { drafts, remove, loaded, reload: load };
}

export function DraftList({ drafts, remove, heading = true }: {
  drafts: UnfinishedCase[];
  remove: (id: string) => void;
  heading?: boolean;
}) {
  const conditions = useConditionNames();

  if (drafts.length === 0) return null;

  return (
    <section>
      {heading && <h2 className="cg-eyebrow">Unfinished</h2>}
      <ul className="mt-2.5 space-y-2.5">
        {drafts.map((d) => {
          const names = d.refs.map((r) => conditions[r.condition_id]).filter(Boolean).join(", ");
          // Back to the question they stopped on, not the top of the flow. The
          // draft id rides along so the resumed session writes to the same row.
          const href = `/author/compose?conditions=${encodeConditions(d.refs)}&draft=${d.id}`
            + (d.screenId ? `&screen=${d.screenId}` : "");
          const scenario = screenSummary("query", d.state);
          const primary = d.state?.primary?.trim();
          return (
            <li key={d.id} className="cg-card px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={href} className="block">
                    <span className="text-sm font-medium text-brand-700">
                      {names || "Case in progress"}
                    </span>
                    <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-neutral-800">
                      {scenario || primary || <span className="italic text-neutral-400">Nothing written yet</span>}
                    </p>
                    <span className="mt-1.5 block text-xs text-neutral-400">
                      Last edited {timeAgo(d.updatedAt)}
                    </span>
                  </Link>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link to={href} className="cg-btn-secondary px-3 py-1.5 text-xs">
                    Continue
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm("Discard this unfinished case? What you entered will be cleared.")) remove(d.id);
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
      .catch(() => { /* label-only, the link still works */ });
    return () => { cancelled = true; };
  }, []);
  return map;
}
