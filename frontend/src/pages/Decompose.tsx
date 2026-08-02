// Rater-facing decomposition task (ADR-032): intro → 15 items one at a time
// → finish. Teaches ONLY the trivial split/keep mechanic — the decomposition
// rulebook is deliberately absent from every rater-facing surface; the
// measurement depends on raters bringing independent judgment.

import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../AuthContext";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";
import type {
  DecompositionDecision,
  DecompositionItemsPayload,
  DecompositionResponse,
} from "../types";

interface Draft {
  decision: DecompositionDecision | null;
  split_count: string; // input value; validated on save
  reason: string;
}

const EMPTY_DRAFT: Draft = { decision: null, split_count: "", reason: "" };

export function Decompose() {
  const { user } = useAuth();
  const [items, setItems] = useState<DecompositionItemsPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  // step: -1 = intro, 0..14 = item index, 15 = finish
  const [step, setStep] = useState(-1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.decompositionItems(), api.myDecompositionResponses()])
      .then(([payload, responses]) => {
        setItems(payload);
        const d: Record<number, Draft> = {};
        responses.forEach((r: DecompositionResponse) => {
          d[r.item_id] = {
            decision: r.decision,
            split_count: r.split_count?.toString() ?? "",
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

  async function saveAndNext() {
    const item = flat[step];
    const d = draftFor(item.id);
    if (!d.decision) return setSaveError("Choose keep whole or split first.");
    const count = d.decision === "split" ? parseInt(d.split_count, 10) : null;
    if (d.decision === "split" && (!count || count < 2))
      return setSaveError("How many pieces would you split it into? (at least 2)");
    if (!d.reason.trim()) return setSaveError("A one-line reason is required — it's the most useful part.");

    setSaving(true);
    setSaveError(null);
    try {
      await api.saveDecompositionResponse(item.id, {
        decision: d.decision,
        split_count: count,
        reason: d.reason.trim(),
      });
      setSaved((s) => new Set(s).add(item.id));
      setStep(step + 1);
      window.scrollTo(0, 0);
    } catch {
      setSaveError("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- intro ----------
  if (step === -1) {
    return (
      <PageContainer>
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            ClinicalGuard · rating task
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-neutral-900">
            Splitting rubric items into pieces
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            15 items, about 25–35 minutes. There's no answer key you're being checked against —
            it's your independent clinical judgment we want.
          </p>

          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-700">
            <p>
              In our scoring, each rubric item is checked against an AI's response as a yes/no:
              did the response do this, or not. That's clean when an item is a single thing, and
              messy when one item quietly contains several separate clinical decisions — a single
              yes/no can't fairly capture a response that got one part right and another wrong.
            </p>
            <p>
              So for each item: if it bundles more than one separately-checkable clinical
              decision, split it. If it's a single decision, keep it whole. Each item is shown
              under its source case with the clinical query, so you judge it in context.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-sm font-semibold text-neutral-900">The mechanic, on a deliberately trivial example</p>
            <div className="mt-3 space-y-2 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
              <p>
                <span className="font-mono text-[13px]">"order a chest X-ray and a full blood count"</span>{" "}
                <span className="font-semibold text-brand-700">→</span> two separate things: split into{" "}
                <span className="font-mono text-[13px]">"orders chest X-ray"</span> and{" "}
                <span className="font-mono text-[13px]">"orders full blood count"</span>.
              </p>
              <p>
                <span className="font-mono text-[13px]">"order an ECG"</span>{" "}
                <span className="font-semibold text-brand-700">→</span> already one thing: keep whole.
              </p>
            </div>
            <p className="mt-3 text-sm text-neutral-500">
              That's only to show the format. The real items are less obvious, and how to handle
              them is your call, in the context of the case.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Two things to know</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                The one-line reason you give for each item matters as much as the answer. If
                something feels genuinely ambiguous, say so — that's useful signal, not a wrong answer.
              </li>
              <li>
                You can go back and revise earlier answers at any point, including after you've
                changed your mind mid-task. Nothing holds you to an earlier call.
              </li>
            </ul>
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
        </div>
      </PageContainer>
    );
  }

  // ---------- finish ----------
  if (step >= total) {
    return (
      <PageContainer>
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">That's all 15 — thank you.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
            Thanks for doing this carefully — the reasons you wrote are the most useful part.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            You can still revise any answer below; your changes save the same way.
          </p>
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
                      {d.decision === "split" ? `split · ${d.split_count}` : d.decision ? "kept whole" : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
            {item.source_note && <span className="ml-2 font-sans text-sm text-neutral-400">— {item.source_note}</span>}
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
                  ? "Why these are separately-checkable decisions — or what feels ambiguous"
                  : "Why this is one decision — or what feels ambiguous"
              }
            />
          </div>
        )}

        {saveError && <div className="mt-4"><ErrorBox message={saveError} /></div>}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => { setStep(step - 1); setSaveError(null); window.scrollTo(0, 0); }}
            className="cg-btn-ghost"
          >
            ← {step === 0 ? "Intro" : "Previous"}
          </button>
          <button onClick={saveAndNext} disabled={saving} className="cg-btn-primary px-6 py-2.5">
            {saving ? "Saving…" : step === total - 1 ? "Save & finish" : "Save & continue"}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
