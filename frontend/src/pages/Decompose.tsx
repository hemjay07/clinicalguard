// Rater-facing decomposition task (ADR-032): intro → 15 items one at a time
// → finish. Teaches ONLY the trivial split/keep mechanic — the decomposition
// rulebook is deliberately absent from every rater-facing surface; the
// measurement depends on raters bringing independent judgment.

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../AuthContext";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";
import { NoteLink, ExitFeedback } from "../components/FeedbackNote";
import type {
  DecompositionDecision,
  DecompositionItemsPayload,
  DecompositionResponse,
} from "../types";

interface Draft {
  decision: DecompositionDecision | null;
  split_count: string; // input value; validated on save
  // One brief label per piece — always the rater's own words, never
  // pre-populated or suggested (that would contaminate the measurement).
  labels: string[];
  reason: string;
}

const EMPTY_DRAFT: Draft = { decision: null, split_count: "", labels: [], reason: "" };

export function Decompose() {
  const { user } = useAuth();
  const [items, setItems] = useState<DecompositionItemsPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  // step: -1 = intro, 0..14 = item index, 15 = finish
  const [step, setStep] = useState(-1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // (no blocking "saving" state — continue never waits on the network)
  // Background-save bookkeeping (optimistic UI): continue advances instantly,
  // the PUT runs behind. A failed save is surfaced and the answer kept in the
  // draft for retry — never fire-and-forget.
  const [inflight, setInflight] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<Set<number>>(new Set());
  // Per-item promise chain so a quick revise of the same item can't race an
  // earlier save (last write wins, in order).
  const chains = useRef(new Map<number, Promise<unknown>>());

  useEffect(() => {
    Promise.all([api.decompositionItems(), api.myDecompositionResponses()])
      .then(([payload, responses]) => {
        setItems(payload);
        const d: Record<number, Draft> = {};
        responses.forEach((r: DecompositionResponse) => {
          d[r.item_id] = {
            decision: r.decision,
            split_count: r.split_count?.toString() ?? "",
            labels: r.split_labels ?? [],
            reason: r.reason,
          };
        });
        setDrafts(d);
        setSaved(new Set(responses.map((r) => r.item_id)));
      })
      .catch(() => setLoadError("Couldn't load the task. Please refresh to try again."));
  }, []);

  // Flat, ordered list of the 15 items, each with its case context.
  const flat = useMemo(
    () =>
      (items?.groups ?? []).flatMap((g) =>
        g.items.map((item) => ({ ...item, case_label: g.case_label, clinical_query: g.clinical_query })),
      ),
    [items],
  );

  if (loadError) return <PageContainer><ErrorBox message={loadError} /></PageContainer>;
  if (!items) return <PageContainer><Spinner label="Loading the task…" /></PageContainer>;

  const total = flat.length;
  const answered = saved.size;

  function draftFor(id: number): Draft {
    return drafts[id] ?? EMPTY_DRAFT;
  }

  function setDraft(id: number, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...patch } }));
    setSaveError(null);
  }

  function validateDraft(d: Draft): { error: string } | { payload: Parameters<typeof api.saveDecompositionResponse>[1] } {
    if (!d.decision) return { error: "Choose keep whole or split first." };
    const count = d.decision === "split" ? parseInt(d.split_count, 10) : null;
    if (d.decision === "split" && (!count || count < 2))
      return { error: "How many pieces would you split it into? (at least 2)" };
    const labels = count ? Array.from({ length: count }, (_, i) => (d.labels[i] ?? "").trim()) : null;
    if (labels && labels.some((l) => !l))
      return { error: "Name each piece in a few words. That's the part that captures how you cut it." };
    if (!d.reason.trim()) return { error: "A one-line reason is required, it's the most useful part." };
    return { payload: { decision: d.decision, split_count: count, split_labels: labels, reason: d.reason.trim() } };
  }

  function mutate(set: React.Dispatch<React.SetStateAction<Set<number>>>, id: number, add: boolean) {
    set((s) => {
      const next = new Set(s);
      if (add) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function saveInBackground(itemId: number, payload: Parameters<typeof api.saveDecompositionResponse>[1]) {
    mutate(setInflight, itemId, true);
    mutate(setFailed, itemId, false);
    const prev = chains.current.get(itemId) ?? Promise.resolve();
    const run = prev
      .catch(() => {})
      .then(() => api.saveDecompositionResponse(itemId, payload));
    chains.current.set(itemId, run);
    run
      .then(() => {
        setSaved((s) => new Set(s).add(itemId));
        mutate(setFailed, itemId, false);
      })
      .catch(() => mutate(setFailed, itemId, true))
      .finally(() => {
        if (chains.current.get(itemId) === run) chains.current.delete(itemId);
        mutate(setInflight, itemId, false);
      });
  }

  function retryFailed() {
    for (const id of failed) {
      const v = validateDraft(draftFor(id));
      if ("payload" in v) saveInBackground(id, v.payload);
    }
  }

  function saveAndNext() {
    const item = flat[step];
    const v = validateDraft(draftFor(item.id));
    if ("error" in v) return setSaveError(v.error);
    setSaveError(null);
    // Optimistic: advance immediately, save behind. The answer lives in the
    // draft either way, so a failure loses nothing — it surfaces for retry.
    saveInBackground(item.id, v.payload);
    setStep(step + 1);
    window.scrollTo(0, 0);
  }

  // Shown on item + finish screens whenever a background save has failed.
  const failedBanner = failed.size > 0 && (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>
        {failed.size === 1
          ? `Item ${[...failed][0]} didn't save, your answer is kept here.`
          : `Items ${[...failed].sort((a, b) => a - b).join(", ")} didn't save, your answers are kept here.`}
      </span>
      <button onClick={retryFailed} className="cg-btn-secondary px-3 py-1.5 text-sm">
        Retry
      </button>
    </div>
  );

  // ---------- intro ----------
  if (step === -1) {
    return (
      <PageContainer>
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            ClinicalGuard · rating task
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-neutral-900">
            Splitting rubric items
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            15 items, ~25 min. No answer key, we want your independent clinical judgment. Some
            are genuinely hard, so take a moment.
          </p>

          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-700">
            <p>
              Each item gets checked against an AI's response as a yes/no. That works when an
              item is one thing, and breaks when it quietly holds several separate decisions.
            </p>
            {/* The briefing withholds the decomposition rulebook on purpose
                (ADR-032): the measurement is what raters bring unaided, so
                nothing here may explain why items might belong together.
                Changing this paragraph changes what is being measured — bump
                BRIEFING_VERSION on the server when it changes again. */}
            <p>
              So for each item: if it bundles more than one separately-checkable clinical
              decision, split it into those pieces. If it's a single decision, keep it whole. Use
              your judgment for the in-between: sometimes things are written together because
              they genuinely belong together, and splitting them would misrepresent the clinical
              intent. Whether an item is truly separable is your call, in the context of the
              case.
            </p>
            <p>
              Example: "chest X-ray and full blood count" → split. "order an ECG" → keep whole.
              (Just the format, real items are subtler.)
            </p>
            <p>The one-line reason matters as much as the answer. You can revise anytime.</p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={() => setStep(0)} className="cg-btn-primary px-6 py-2.5">
              {answered === 0 ? "Start" : answered >= total ? "Review your answers" : `Continue (${answered} of ${total} done)`}
            </button>
            {user?.is_owner && (
              <button onClick={() => api.downloadDecompositionCsv()} className="cg-btn-secondary">
                Download all responses (CSV)
              </button>
            )}
          </div>

          {/* Priming: legitimize notes up front so mid-task use feels normal. */}
          <p className="mt-5 text-xs text-neutral-400">
            If anything's unclear along the way, use the note link under any screen, it helps
            me fix the tool, and you just keep going.
          </p>
          <div className="mt-2">
            <NoteLink flow="decomposition" context="intro" />
          </div>
        </div>
      </PageContainer>
    );
  }

  // ---------- finish ----------
  if (step >= total) {
    return (
      <PageContainer>
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">That's all 15. Thank you.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
            Thanks for doing this carefully, the reasons you wrote are the most useful part.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            You can still revise any answer below; your changes save the same way.
          </p>
          {inflight.size > 0 && (
            <p className="mt-2 text-xs text-neutral-400">Saving your last answers…</p>
          )}
          {failedBanner}
          {/* One optional exit prompt, once per rater (localStorage-gated so
              revisiting the finish screen doesn't nag). */}
          {localStorage.getItem("cg_decomp_exit_fb") !== "1" && (
            <ExitFeedback
              flow="decomposition"
              context="exit: finished task"
              onDone={() => localStorage.setItem("cg_decomp_exit_fb", "1")}
            />
          )}
          <ul className="mt-6 space-y-2">
            {flat.map((item, i) => {
              const d = draftFor(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => { setStep(i); window.scrollTo(0, 0); }}
                    className="flex w-full items-baseline gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="font-semibold text-brand-700">{item.id}</span>
                    <span className="flex-1 truncate text-neutral-700">{item.text}</span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {d.decision === "split" ? `split · ${d.split_count}` : d.decision ? "kept whole" : "not answered"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-5">
            <NoteLink flow="decomposition" context="finish" />
          </div>
        </div>
      </PageContainer>
    );
  }

  // ---------- one item ----------
  const item = flat[step];
  const d = draftFor(item.id);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-semibold uppercase tracking-wider">Item {step + 1} of {total}</span>
          <span>{answered} saved · you can revise earlier answers anytime</span>
        </div>
        <div className="mt-2 h-1 w-full rounded-full bg-neutral-200">
          <div
            className="h-1 rounded-full bg-brand-700 transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-700">{item.case_label}</p>
        <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {item.case_label.startsWith("Case F") ? "Note" : "Clinical query"}
          </span>
          {item.clinical_query}
        </div>

        <div className="mt-4 rounded-xl border border-neutral-300 bg-white px-5 py-4">
          <p className="font-mono text-[14px] leading-relaxed text-neutral-800">
            {item.text}
            {item.source_note && <span className="ml-2 font-sans text-sm text-neutral-400">({item.source_note})</span>}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {(["keep_whole", "split"] as const).map((choice) => (
            <button
              key={choice}
              onClick={() => setDraft(item.id, { decision: choice })}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                d.decision === choice
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {choice === "keep_whole" ? "Keep whole" : "Split"}
            </button>
          ))}
        </div>

        {d.decision === "split" && (
          <div className="mt-4">
            <label className="cg-label">Into how many pieces?</label>
            <input
              type="number"
              min={2}
              max={10}
              inputMode="numeric"
              className="cg-input w-28"
              value={d.split_count}
              onChange={(e) => setDraft(item.id, { split_count: e.target.value })}
            />
            {(() => {
              const n = parseInt(d.split_count, 10);
              if (!n || n < 2) return null;
              return (
                <div className="mt-3">
                  <label className="cg-label">Name each piece, a few words is plenty</label>
                  <div className="space-y-2">
                    {Array.from({ length: Math.min(n, 10) }, (_, i) => (
                      <input
                        key={i}
                        type="text"
                        className="cg-input"
                        placeholder={`Piece ${i + 1}`}
                        value={d.labels[i] ?? ""}
                        onChange={(e) => {
                          const labels = [...d.labels];
                          labels[i] = e.target.value;
                          setDraft(item.id, { labels });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {d.decision && (
          <div className="mt-4">
            <label className="cg-label">One-line reason (required)</label>
            <textarea
              className="cg-input min-h-[72px]"
              value={d.reason}
              onChange={(e) => setDraft(item.id, { reason: e.target.value })}
              placeholder={
                d.decision === "split"
                  ? "Why these are separately-checkable decisions, or what feels ambiguous"
                  : "Why this is one decision, or what feels ambiguous"
              }
            />
          </div>
        )}

        {saveError && <div className="mt-4"><ErrorBox message={saveError} /></div>}
        {failedBanner}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => { setStep(step - 1); setSaveError(null); window.scrollTo(0, 0); }}
            className="cg-btn-ghost"
          >
            ← {step === 0 ? "Intro" : "Previous"}
          </button>
          <button onClick={saveAndNext} className="cg-btn-primary px-6 py-2.5">
            {step === total - 1 ? "Save & finish" : "Save & continue"}
          </button>
        </div>

        <div className="mt-5">
          <NoteLink
            flow="decomposition"
            context={`item ${item.id} (step ${step + 1} of ${total})`}
            label="Something unclear about this item?"
          />
        </div>
      </div>
    </PageContainer>
  );
}
