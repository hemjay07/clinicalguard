import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useFetch } from "../useFetch";
import { Spinner, ErrorBox } from "../components/ui";
import { SourcePanel } from "../components/SourcePanel";
import { GuidanceIcon } from "../components/GuidancePopover";
import { QUERY_GUIDANCE, TIER_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE } from "../guidance";
import { saveDraft, loadDraft, clearDraft } from "../storage";
import type { EvalCasePayload, SituationalItem } from "../types";

interface FormState {
  authored_by: string;
  query: string;
  what_this_evaluates: string;
  query_scope: string;
  primary: string;
  critical_differentials: string;
  other_considerations: string;
  inv_required: string;
  inv_expected: string;
  inv_situational: string;
  tx_required: string;
  tx_expected: string;
  tx_situational: string;
  complications: string;
  mon_principle: string;
  mon_required: string;
  mon_expected: string;
  esc_required: string;
  esc_expected: string;
  selected_rule_ids: number[];
  safety_free_text: string;
}

const EMPTY: FormState = {
  authored_by: "", query: "", what_this_evaluates: "", query_scope: "",
  primary: "", critical_differentials: "", other_considerations: "",
  inv_required: "", inv_expected: "", inv_situational: "",
  tx_required: "", tx_expected: "", tx_situational: "",
  complications: "", mon_principle: "", mon_required: "", mon_expected: "",
  esc_required: "", esc_expected: "", selected_rule_ids: [], safety_free_text: "",
};

const lines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);

// Parse "item — trigger: text" (em-dash or hyphen) into {item, trigger}.
function parseSituational(s: string): SituationalItem[] {
  return lines(s).map((line) => {
    const m = line.split(/\s*[—-]\s*trigger:\s*/i);
    if (m.length >= 2) return { item: m[0].trim(), trigger: m.slice(1).join(" ").trim() };
    return { item: line, trigger: "" };
  });
}

function toPayload(f: FormState, conditionId: number, subtype: string | null): EvalCasePayload {
  return {
    condition_id: conditionId,
    subtype,
    authored_by: f.authored_by.trim(),
    query: f.query.trim(),
    what_this_evaluates: f.what_this_evaluates.trim(),
    query_scope: f.query_scope.trim(),
    diagnoses: {
      primary: f.primary.trim(),
      critical_differentials: lines(f.critical_differentials),
      other_considerations: lines(f.other_considerations),
    },
    investigations: {
      required: lines(f.inv_required),
      expected: lines(f.inv_expected),
      situational: parseSituational(f.inv_situational),
    },
    treatments: {
      required: lines(f.tx_required),
      expected: lines(f.tx_expected),
      situational: parseSituational(f.tx_situational),
    },
    complications: lines(f.complications),
    monitoring: {
      required_principle: f.mon_principle.trim(),
      required_elements: lines(f.mon_required),
      expected_elements: lines(f.mon_expected),
    },
    escalation: { required: lines(f.esc_required), expected: lines(f.esc_expected) },
    safety: { selected_rule_ids: f.selected_rule_ids, free_text: lines(f.safety_free_text) },
  };
}

function clientValidate(p: EvalCasePayload): string[] {
  const errs: string[] = [];
  if (!p.query) errs.push("Clinical query is required.");
  if (!p.diagnoses.primary) errs.push("Expected primary diagnosis is required.");
  if (!p.authored_by) errs.push("Your name (authored by) is required.");
  if (p.investigations.required.length === 0 && p.treatments.required.length === 0)
    errs.push("At least one required investigation or one required treatment is needed.");
  for (const s of [...p.investigations.situational, ...p.treatments.situational])
    if (!s.trigger) errs.push(`Situational item "${s.item}" is missing a trigger (use: item — trigger: …).`);
  return errs;
}

// --- small form atoms ---

function Field({ label, guidance, children }: { label: string; guidance?: { title: string; text: string }; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center text-sm font-medium text-slate-700">
        {label}
        {guidance && <GuidanceIcon title={guidance.title} text={guidance.text} />}
      </label>
      {children}
    </div>
  );
}

const ta = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

function Tiers({ prefix, f, set }: { prefix: "inv" | "tx"; f: FormState; set: (patch: Partial<FormState>) => void }) {
  const r = `${prefix}_required` as keyof FormState;
  const e = `${prefix}_expected` as keyof FormState;
  const s = `${prefix}_situational` as keyof FormState;
  return (
    <div className="grid gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required</div>
        <textarea rows={3} className={ta} value={f[r] as string} onChange={(ev) => set({ [r]: ev.target.value } as Partial<FormState>)} placeholder="One item per line" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected</div>
        <textarea rows={3} className={ta} value={f[e] as string} onChange={(ev) => set({ [e]: ev.target.value } as Partial<FormState>)} placeholder="One item per line" />
      </div>
      <div>
        <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          Situational
          <GuidanceIcon title="Writing situational triggers" text={TRIGGER_GUIDANCE} />
        </div>
        <p className="mb-1 text-xs text-slate-400">Format: [item] — trigger: [trigger condition]</p>
        <textarea rows={2} className={ta} value={f[s] as string} onChange={(ev) => set({ [s]: ev.target.value } as Partial<FormState>)} placeholder="CSF analysis — trigger: AI raises meningitis as a differential" />
      </div>
    </div>
  );
}

export function Authoring() {
  const { conditionId } = useParams();
  const id = Number(conditionId);
  const [searchParams] = useSearchParams();
  const subtype = searchParams.get("subtype");
  const navigate = useNavigate();

  const details = useFetch(() => api.conditionDetails(id), [id]);
  const source = useFetch(() => api.sourceMaterial(id, subtype), [id, subtype]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPanel, setShowPanel] = useState(true); // desktop panel visibility
  const [mobileOpen, setMobileOpen] = useState(false); // mobile slide-in overlay
  const [introOpen, setIntroOpen] = useState(true);
  const [loadedDraft, setLoadedDraft] = useState(false);

  // Load any saved draft once, keyed by condition+subtype.
  useEffect(() => {
    const d = loadDraft<FormState>(id, subtype);
    if (d) { setForm(d.state); setSavedAt(d.savedAt); }
    else setForm(EMPTY);
    setLoadedDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, subtype]);

  // Autosave on every change (after the initial draft load).
  useEffect(() => {
    if (!loadedDraft) return;
    const at = saveDraft(id, subtype, form);
    setSavedAt(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const toggleRule = (ruleId: number) =>
    setForm((prev) => ({
      ...prev,
      selected_rule_ids: prev.selected_rule_ids.includes(ruleId)
        ? prev.selected_rule_ids.filter((x) => x !== ruleId)
        : [...prev.selected_rule_ids, ruleId],
    }));

  const payload = useMemo(() => toPayload(form, id, subtype), [form, id, subtype]);

  async function submit() {
    const errs = clientValidate(payload);
    setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    try {
      await api.createEvalCase(payload);
      clearDraft(id, subtype);
      navigate("/cases");
    } catch (e) {
      if (e instanceof ApiError && e.detail && typeof e.detail === "object" && "errors" in (e.detail as any))
        setErrors((e.detail as any).errors);
      else setErrors([e instanceof Error ? e.message : "Submission failed."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (details.loading) return <div className="p-8"><Spinner /></div>;
  if (details.error) return <div className="p-8"><ErrorBox message={details.error} /></div>;

  return (
    <div className="relative mx-auto flex w-full max-w-7xl gap-4 px-4 py-6">
      {/* Form */}
      <div className={showPanel ? "w-full lg:w-[60%]" : "w-full"}>
        {/* Section A: condition context */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{details.data?.name}</h1>
              {subtype && <p className="text-sm text-slate-500">{subtype}</p>}
              <p className="mt-1 text-xs text-slate-400">Authoring an eval case for {details.data?.name}</p>
            </div>
            <button onClick={() => setShowPanel((s) => !s)} className="hidden rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 lg:block">
              {showPanel ? "Hide source" : "Show source"}
            </button>
          </div>
          {details.data?.introduction && (
            <div className="mt-3">
              <button onClick={() => setIntroOpen((o) => !o)} className="text-xs font-medium text-brand-700">
                {introOpen ? "Hide" : "Show"} NSTG introduction
              </button>
              {introOpen && <p className="mt-2 text-sm leading-relaxed text-slate-600">{details.data.introduction}</p>}
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-semibold">Please fix:</p>
            <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className="space-y-4">
          {/* B: query */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Authored by" >
              <input className={ta} value={form.authored_by} onChange={(e) => set({ authored_by: e.target.value })} placeholder="Your name" />
            </Field>
            <Field label="Clinical query" guidance={{ title: "Writing the clinical query", text: QUERY_GUIDANCE }}>
              <textarea rows={3} className={ta} value={form.query} onChange={(e) => set({ query: e.target.value })} placeholder="A realistic clinical scenario — 1-3 sentences ending in scope." />
            </Field>
            <Field label="What this case evaluates" guidance={{ title: "What this case evaluates", text: WHAT_THIS_EVALUATES_GUIDANCE }}>
              <textarea rows={2} className={ta} value={form.what_this_evaluates} onChange={(e) => set({ what_this_evaluates: e.target.value })} placeholder="Optional but recommended." />
            </Field>
            <Field label="Query scope (optional)">
              <input className={ta} value={form.query_scope} onChange={(e) => set({ query_scope: e.target.value })} placeholder="e.g. diagnosis + initial management; excludes long-term follow-up" />
            </Field>
          </div>

          {/* B2: diagnoses */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Expected diagnoses</h2>
            <Field label="Primary diagnosis">
              <input className={ta} value={form.primary} onChange={(e) => set({ primary: e.target.value })} placeholder="The diagnosis the AI should reach (kept out of the query)." />
            </Field>
            <Field label="Critical differentials (required to consider)">
              <textarea rows={2} className={ta} value={form.critical_differentials} onChange={(e) => set({ critical_differentials: e.target.value })} placeholder="One per line" />
            </Field>
            <Field label="Other considerations (a thorough response would include)">
              <textarea rows={2} className={ta} value={form.other_considerations} onChange={(e) => set({ other_considerations: e.target.value })} placeholder="One per line" />
            </Field>
          </div>

          {/* C: investigations */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center text-sm font-semibold uppercase tracking-wide text-slate-500">
              Investigations the AI should address
              <GuidanceIcon title="About the tier categories" text={TIER_GUIDANCE} />
            </h2>
            <Tiers prefix="inv" f={form} set={set} />
          </div>

          {/* D: treatments */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center text-sm font-semibold uppercase tracking-wide text-slate-500">
              Treatments the AI should address
              <GuidanceIcon title="About the tier categories" text={TIER_GUIDANCE} />
            </h2>
            <Tiers prefix="tx" f={form} set={set} />
          </div>

          {/* F: complications */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Complications the AI should address">
              <textarea rows={3} className={ta} value={form.complications} onChange={(e) => set({ complications: e.target.value })} placeholder="One complication per line" />
            </Field>
          </div>

          {/* G: monitoring + escalation */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Monitoring &amp; escalation</h2>
            <Field label="Monitoring principle">
              <input className={ta} value={form.mon_principle} onChange={(e) => set({ mon_principle: e.target.value })} placeholder="e.g. Active monitoring is essential, not optional." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Monitoring — required elements">
                <textarea rows={3} className={ta} value={form.mon_required} onChange={(e) => set({ mon_required: e.target.value })} placeholder="One per line" />
              </Field>
              <Field label="Monitoring — expected elements">
                <textarea rows={3} className={ta} value={form.mon_expected} onChange={(e) => set({ mon_expected: e.target.value })} placeholder="One per line" />
              </Field>
              <Field label="Escalation triggers — required">
                <textarea rows={3} className={ta} value={form.esc_required} onChange={(e) => set({ esc_required: e.target.value })} placeholder="One per line" />
              </Field>
              <Field label="Escalation triggers — expected">
                <textarea rows={3} className={ta} value={form.esc_expected} onChange={(e) => set({ esc_expected: e.target.value })} placeholder="One per line" />
              </Field>
            </div>
          </div>

          {/* H: safety signals */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Safety rules that apply to this scenario</h2>
            <p className="mt-1 text-xs text-slate-400">Select the safety rules that apply to your specific query scope.</p>
            <div className="mt-3 space-y-2">
              {(details.data?.safety_rules ?? []).length === 0 && <p className="text-sm text-slate-400">No safety rules recorded for this condition.</p>}
              {details.data?.safety_rules.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={form.selected_rule_ids.includes(r.id)} onChange={() => toggleRule(r.id)} className="mt-1" />
                  <span><span className="font-semibold">[{r.severity}]</span> {r.description} {r.source && <span className="text-xs text-slate-400">— {r.source}</span>}</span>
                </label>
              ))}
            </div>
            <Field label="Additional free-text safety flags">
              <textarea rows={2} className={`${ta} mt-3`} value={form.safety_free_text} onChange={(e) => set({ safety_free_text: e.target.value })} placeholder="One per line (optional)" />
            </Field>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs text-slate-400">{savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Not yet saved"}</span>
            <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit case"}
            </button>
          </div>
        </div>
      </div>

      {/* Source panel — desktop */}
      {showPanel && (
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[40%] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
          <SourcePanel data={source.data} loading={source.loading} error={source.error} />
        </aside>
      )}

      {/* Source panel — mobile slide-in (hidden by default on mobile) */}
      <button onClick={() => setMobileOpen(true)} className="fixed bottom-4 right-4 z-30 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg lg:hidden">
        Source
      </button>
      <div className={`fixed inset-0 z-40 transform bg-white transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <button onClick={() => setMobileOpen(false)} className="self-end p-3 text-slate-500">✕ Close</button>
          <div className="flex-1 overflow-hidden">
            <SourcePanel data={source.data} loading={source.loading} error={source.error} />
          </div>
        </div>
      </div>
    </div>
  );
}
