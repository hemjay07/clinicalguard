import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, ErrorBox } from "../components/ui";
import { SourcePanel } from "../components/SourcePanel";
import { GuidanceIcon } from "../components/GuidancePopover";
import { QUERY_GUIDANCE, TIER_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE, ARCHETYPE_GUIDANCE, ARCHETYPES } from "../guidance";
import { saveDraft, loadDraft, clearDraft, saveAuthorName, loadAuthorName } from "../storage";
import { decodeConditions, draftSlug } from "../selection";
import type { EvalCasePayload, SituationalItem, SourceMaterial, ConditionRef } from "../types";

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
  mon_required: string;
  mon_expected: string;
  esc_required: string;
  esc_expected: string;
  selected_rule_ids: number[];
  safety_free_text: string;
  archetypes: string[];
  other_checked: boolean;
  other_text: string;
}

const EMPTY: FormState = {
  authored_by: "", query: "", what_this_evaluates: "", query_scope: "",
  primary: "", critical_differentials: "", other_considerations: "",
  inv_required: "", inv_expected: "", inv_situational: "",
  tx_required: "", tx_expected: "", tx_situational: "",
  complications: "", mon_required: "", mon_expected: "",
  esc_required: "", esc_expected: "", selected_rule_ids: [], safety_free_text: "",
  archetypes: [], other_checked: false, other_text: "",
};

const lines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);

function parseSituational(s: string): SituationalItem[] {
  return lines(s).map((line) => {
    const m = line.split(/\s*[—-]\s*trigger:\s*/i);
    if (m.length >= 2) return { item: m[0].trim(), trigger: m.slice(1).join(" ").trim() };
    return { item: line, trigger: "" };
  });
}

function toPayload(f: FormState, conditions: ConditionRef[]): EvalCasePayload {
  return {
    conditions,
    authored_by: f.authored_by.trim(),
    query: f.query.trim(),
    what_this_evaluates: f.what_this_evaluates.trim(),
    query_scope: f.query_scope.trim(),
    diagnoses: { primary: f.primary.trim(), critical_differentials: lines(f.critical_differentials), other_considerations: lines(f.other_considerations) },
    investigations: { required: lines(f.inv_required), expected: lines(f.inv_expected), situational: parseSituational(f.inv_situational) },
    treatments: { required: lines(f.tx_required), expected: lines(f.tx_expected), situational: parseSituational(f.tx_situational) },
    complications: lines(f.complications),
    monitoring: { required_elements: lines(f.mon_required), expected_elements: lines(f.mon_expected) },
    escalation: { required: lines(f.esc_required), expected: lines(f.esc_expected) },
    safety: { selected_rule_ids: f.selected_rule_ids, free_text: lines(f.safety_free_text) },
    reasoning_archetypes: f.archetypes,
    other_archetypes: f.other_checked && f.other_text.trim() ? [f.other_text.trim()] : [],
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

const ta = "w-full rounded-md border border-neutral-300 bg-neutral-50/60 px-3 py-1.5 text-sm focus:border-brand-700 focus:bg-white focus:outline-none";

function Field({ label, guidance, children }: { label: string; guidance?: { title: string; text: string }; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 flex items-center text-[13px] font-medium text-neutral-700">
        {label}
        {guidance && <GuidanceIcon title={guidance.title} text={guidance.text} />}
      </label>
      {children}
    </div>
  );
}

function Tiers({ prefix, f, set }: { prefix: "inv" | "tx"; f: FormState; set: (patch: Partial<FormState>) => void }) {
  const r = `${prefix}_required` as keyof FormState;
  const e = `${prefix}_expected` as keyof FormState;
  const s = `${prefix}_situational` as keyof FormState;
  return (
    <div className="divide-y divide-neutral-100">
      <div className="pb-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Required</div>
        <textarea rows={3} className={ta} value={f[r] as string} onChange={(ev) => set({ [r]: ev.target.value } as Partial<FormState>)} placeholder="One item per line" />
      </div>
      <div className="py-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Expected</div>
        <textarea rows={3} className={ta} value={f[e] as string} onChange={(ev) => set({ [e]: ev.target.value } as Partial<FormState>)} placeholder="One item per line" />
      </div>
      <div className="pt-3">
        <div className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Situational
          <GuidanceIcon title="Situational triggers" text={TRIGGER_GUIDANCE} />
        </div>
        <p className="mb-1 text-[11px] text-neutral-400">Format: [item] — trigger: [trigger condition]</p>
        <textarea rows={2} className={ta} value={f[s] as string} onChange={(ev) => set({ [s]: ev.target.value } as Partial<FormState>)} placeholder="CSF analysis — trigger: AI raises meningitis as a differential" />
      </div>
    </div>
  );
}

type SectionStatus = "Not started" | "In progress" | "Filled";
const BADGE: Record<SectionStatus, string> = {
  "Not started": "bg-neutral-100 text-neutral-400",
  "In progress": "bg-amber-100 text-amber-700",
  Filled: "bg-brand-100 text-brand-700",
};

function Section({ num, title, subtitle, status, open, onToggle, children }: {
  num: number; title: string; subtitle: string; status: SectionStatus; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-neutral-50/60">
        <div className="min-w-0">
          <div className="font-serif text-base font-semibold text-neutral-900">{num}. {title}</div>
          <div className="text-xs text-neutral-400">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[status]}`}>{status}</span>
          <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>
      {open && <div className="space-y-2 border-t border-neutral-200 p-5">{children}</div>}
    </div>
  );
}

function statusOf(vals: string[]): SectionStatus {
  const filled = vals.filter((v) => v.trim()).length;
  if (filled === 0) return "Not started";
  if (filled === vals.length) return "Filled";
  return "In progress";
}

interface SourceEntry { ref: ConditionRef; data: SourceMaterial }

export function Authoring() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refs = useMemo(() => decodeConditions(searchParams.get("conditions")), [searchParams]);
  const slug = useMemo(() => draftSlug(refs), [refs]);

  const sources = useFetch<SourceEntry[]>(
    () => Promise.all(refs.map((r) => api.sourceMaterial(r.condition_id, r.subtype).then((data) => ({ ref: r, data })))),
    [slug]
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveKind, setSaveKind] = useState<"none" | "auto" | "draft" | "submitted">("none");
  const [loadedDraftAt, setLoadedDraftAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPanel, setShowPanel] = useState(() => sessionStorage.getItem("cg_show_source") !== "0");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<number, boolean>>(() => {
    try { return { 1: true, 2: true, 3: true, ...JSON.parse(sessionStorage.getItem("cg_sections") || "{}") }; }
    catch { return { 1: true, 2: true, 3: true }; }
  });

  useEffect(() => { sessionStorage.setItem("cg_show_source", showPanel ? "1" : "0"); }, [showPanel]);
  useEffect(() => { sessionStorage.setItem("cg_sections", JSON.stringify(sectionsOpen)); }, [sectionsOpen]);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load draft once per selection. Author name persists globally.
  useEffect(() => {
    const d = loadDraft<FormState>(slug);
    const savedName = loadAuthorName();
    if (d) {
      setForm({ ...EMPTY, ...d.state, authored_by: d.state.authored_by || savedName });
      setSavedAt(d.savedAt);
      setSaveKind("auto");
      setLoadedDraftAt(d.savedAt);
    } else {
      setForm({ ...EMPTY, authored_by: savedName });
      setSavedAt(null);
      setSaveKind("none");
      setLoadedDraftAt(null);
    }
    setLoadedDraft(true);
    setActiveTab(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!loadedDraft) return;
    setSavedAt(saveDraft(slug, form));
    setSaveKind("auto");
    saveAuthorName(form.authored_by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const toggleSection = (n: number) => setSectionsOpen((p) => ({ ...p, [n]: !p[n] }));
  const toggleArchetype = (value: string) =>
    setForm((prev) => ({ ...prev, archetypes: prev.archetypes.includes(value) ? prev.archetypes.filter((x) => x !== value) : [...prev.archetypes, value] }));
  const toggleRule = (ruleId: number) =>
    setForm((prev) => ({ ...prev, selected_rule_ids: prev.selected_rule_ids.includes(ruleId) ? prev.selected_rule_ids.filter((x) => x !== ruleId) : [...prev.selected_rule_ids, ruleId] }));

  function saveDraftNow() { setSavedAt(saveDraft(slug, form)); setSaveKind("draft"); }
  function discardDraft() { clearDraft(slug); setForm(EMPTY); setSavedAt(null); setSaveKind("none"); setLoadedDraftAt(null); }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const saveIndicator =
    saveKind === "auto" && savedAt ? `Auto-saved at ${fmtTime(savedAt)}`
    : saveKind === "draft" && savedAt ? `Draft saved at ${fmtTime(savedAt)}`
    : saveKind === "submitted" && savedAt ? `Submitted at ${fmtTime(savedAt)}`
    : "Not yet saved";

  const names = useMemo(() => (sources.data ?? []).map((s) => s.data.condition.name), [sources.data]);

  const safetyRules = useMemo(() => {
    const map = new Map<number, { id: number; severity: string; description: string; source: string | null }>();
    (sources.data ?? []).forEach((s) =>
      (s.data.safety_signals.verified_safety_rules ?? []).forEach((r) => {
        if (!map.has(r.rule_id)) map.set(r.rule_id, { id: r.rule_id, severity: r.severity, description: r.description, source: r.source });
      })
    );
    return [...map.values()];
  }, [sources.data]);

  const payload = useMemo(() => toPayload(form, refs), [form, refs]);

  const s1Status = statusOf([form.authored_by, form.archetypes.length || form.other_checked ? "x" : "", form.query, form.what_this_evaluates, form.query_scope]);
  const s2Status = statusOf([form.primary, form.critical_differentials, form.other_considerations, form.inv_required, form.inv_expected, form.inv_situational, form.tx_required, form.tx_expected, form.tx_situational, form.complications, form.mon_required, form.mon_expected, form.esc_required, form.esc_expected]);
  const s3Status = statusOf([form.selected_rule_ids.length ? "x" : "", form.safety_free_text]);

  async function submit() {
    const errs = clientValidate(payload);
    setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    try {
      await api.createEvalCase(payload);
      setSaveKind("submitted");
      setSavedAt(new Date().toISOString());
      clearDraft(slug);
      navigate("/cases");
    } catch (e) {
      if (e instanceof ApiError && e.detail && typeof e.detail === "object" && "errors" in (e.detail as any)) setErrors((e.detail as any).errors);
      else setErrors([e instanceof Error ? e.message : "Submission failed."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (refs.length === 0) {
    return (
      <PageContainer>
        <ErrorBox message="No conditions selected." />
        <Link to="/author" className="mt-3 inline-block text-brand-700 hover:underline">← Choose conditions</Link>
      </PageContainer>
    );
  }

  const intro = sources.data?.[0]?.data.condition.introduction;

  const sourceArea = (
    <div className="flex h-full flex-col">
      {(sources.data?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 px-2 pt-2">
          {(sources.data ?? []).map((s, i) => (
            <button key={s.ref.condition_id} onClick={() => setActiveTab(i)}
              className={`rounded-t px-3 py-1.5 text-xs font-medium ${i === activeTab ? "bg-white text-brand-700 ring-1 ring-neutral-200" : "text-neutral-500 hover:bg-neutral-100"}`}>
              {s.data.condition.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SourcePanel data={sources.data?.[activeTab]?.data ?? null} loading={sources.loading} error={sources.error} />
      </div>
    </div>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-7xl gap-4 px-4 py-6">
      <div className={showPanel ? "w-full lg:w-[60%]" : "w-full"}>
        {/* Sticky header bar: title + save state */}
        <div className="sticky top-0 z-20 mb-3 flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50/90 px-4 py-2 backdrop-blur">
          <h1 className="min-w-0 truncate font-serif text-base font-semibold text-neutral-900">
            {names.length ? names.join(", ") : "Loading…"}
          </h1>
          <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{saveIndicator}</span>
            <button onClick={() => setShowPanel((s) => !s)} className="hidden rounded border border-neutral-300 px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 lg:block">
              {showPanel ? "Hide source" : "Show source"}
            </button>
          </div>
        </div>

        {/* condition context line + collapsible intro */}
        <p className="mb-2 text-xs text-neutral-400">Authoring an eval case for: {names.length ? names.join(", ") : "…"}</p>
        {intro && (
          <div className="mb-3">
            <button onClick={() => setIntroOpen((o) => !o)} className="text-xs font-medium text-brand-700">{introOpen ? "Hide" : "Show"} NSTG introduction</button>
            {introOpen && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{intro}</p>}
          </div>
        )}

        {loadedDraftAt && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span>Loaded draft saved at {fmtTime(loadedDraftAt)} on {new Date(loadedDraftAt).toLocaleDateString()}.</span>
            <button onClick={discardDraft} className="font-medium underline hover:no-underline">Discard draft and start fresh</button>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-semibold">Please fix:</p>
            <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className="space-y-4">
          {/* SECTION 1 — Frame the case */}
          <Section num={1} title="Frame the case" subtitle="what the case is about and what reasoning it tests" status={s1Status} open={sectionsOpen[1]} onToggle={() => toggleSection(1)}>
            <Field label="Authored by"><input className={ta} value={form.authored_by} onChange={(e) => set({ authored_by: e.target.value })} placeholder="Your name" /></Field>

            <div className="mb-3">
              <div className="flex items-center text-[13px] font-medium text-neutral-700">
                Reasoning patterns this case exercises
                <GuidanceIcon title="Reasoning patterns" text={ARCHETYPE_GUIDANCE} />
              </div>
              <p className="mb-2 text-[11px] text-neutral-400">Optional. Pick these first, then write a query that exercises them.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ARCHETYPES.map((a) => (
                  <label key={a.value} className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={form.archetypes.includes(a.value)} onChange={() => toggleArchetype(a.value)} className="mt-1" />
                    <span><span className="font-medium">{a.label}</span><span className="block text-[11px] font-normal text-neutral-400">{a.subtitle}</span></span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={form.other_checked} onChange={(e) => set({ other_checked: e.target.checked })} className="mt-1" />
                  <span>Other (specify)</span>
                </label>
              </div>
              {form.other_checked && <input className={`${ta} mt-2`} value={form.other_text} onChange={(e) => set({ other_text: e.target.value })} placeholder="Describe the reasoning pattern" />}
            </div>

            <Field label="Clinical query" guidance={{ title: "Writing the clinical query", text: QUERY_GUIDANCE }}>
              <textarea rows={3} className={ta} value={form.query} onChange={(e) => set({ query: e.target.value })} placeholder="A realistic clinical scenario — 1-3 sentences ending in scope." />
            </Field>
            <Field label="What this case evaluates" guidance={{ title: "What this case evaluates", text: WHAT_THIS_EVALUATES_GUIDANCE }}>
              <textarea rows={2} className={ta} value={form.what_this_evaluates} onChange={(e) => set({ what_this_evaluates: e.target.value })} placeholder="Optional but recommended." />
            </Field>
            <Field label="Query scope (optional)">
              <input className={ta} value={form.query_scope} onChange={(e) => set({ query_scope: e.target.value })} placeholder="e.g. diagnosis + initial management; excludes long-term follow-up" />
            </Field>
          </Section>

          {/* SECTION 2 — Author the expected response */}
          <Section num={2} title="Author the expected response" subtitle="what a competent AI should address" status={s2Status} open={sectionsOpen[2]} onToggle={() => toggleSection(2)}>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Expected diagnoses</div>
              <Field label="Primary diagnosis"><input className={ta} value={form.primary} onChange={(e) => set({ primary: e.target.value })} placeholder="The diagnosis the AI should reach (kept out of the query)." /></Field>
              <Field label="Critical differentials">
                <p className="mb-1 text-[11px] text-neutral-400">Differentials the AI must consider</p>
                <textarea rows={2} className={ta} value={form.critical_differentials} onChange={(e) => set({ critical_differentials: e.target.value })} placeholder="One per line" />
              </Field>
              <Field label="Other considerations the AI should address"><textarea rows={2} className={ta} value={form.other_considerations} onChange={(e) => set({ other_considerations: e.target.value })} placeholder="One per line" /></Field>
            </div>

            <div className="border-t border-neutral-100 pt-3">
              <div className="mb-2 flex items-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Investigations the AI should address<GuidanceIcon title="Tier categories" text={TIER_GUIDANCE} /></div>
              <Tiers prefix="inv" f={form} set={set} />
            </div>

            <div className="border-t border-neutral-100 pt-3">
              <div className="mb-2 flex items-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Treatments the AI should address<GuidanceIcon title="Tier categories" text={TIER_GUIDANCE} /></div>
              <Tiers prefix="tx" f={form} set={set} />
            </div>

            <div className="border-t border-neutral-100 pt-3">
              <Field label="Complications the AI should address"><textarea rows={3} className={ta} value={form.complications} onChange={(e) => set({ complications: e.target.value })} placeholder="One complication per line" /></Field>
            </div>

            <div className="border-t border-neutral-100 pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Monitoring &amp; escalation</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Monitoring — required elements"><textarea rows={3} className={ta} value={form.mon_required} onChange={(e) => set({ mon_required: e.target.value })} placeholder="One per line" /></Field>
                <Field label="Monitoring — expected elements"><textarea rows={3} className={ta} value={form.mon_expected} onChange={(e) => set({ mon_expected: e.target.value })} placeholder="One per line" /></Field>
                <Field label="Escalation triggers — required"><textarea rows={3} className={ta} value={form.esc_required} onChange={(e) => set({ esc_required: e.target.value })} placeholder="One per line" /></Field>
                <Field label="Escalation triggers — expected"><textarea rows={3} className={ta} value={form.esc_expected} onChange={(e) => set({ esc_expected: e.target.value })} placeholder="One per line" /></Field>
              </div>
            </div>
          </Section>

          {/* SECTION 3 — Safety layer */}
          <Section num={3} title="Safety layer" subtitle="guideline-grounded safety rules that apply" status={s3Status} open={sectionsOpen[3]} onToggle={() => toggleSection(3)}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Safety rules that apply to this scenario</div>
              <p className="mt-1 text-[11px] text-neutral-400">Select the safety rules that apply to your specific query scope (rules from all selected conditions).</p>
              <div className="mt-3 space-y-2">
                {safetyRules.length === 0 && <p className="text-sm text-neutral-400">No verified safety rules recorded for the selected condition(s).</p>}
                {safetyRules.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-start gap-2 rounded border border-neutral-200 p-2 text-sm hover:bg-neutral-50">
                    <input type="checkbox" checked={form.selected_rule_ids.includes(r.id)} onChange={() => toggleRule(r.id)} className="mt-1" />
                    <span><span className="font-semibold">[{r.severity}]</span> {r.description} {r.source && <span className="text-[11px] text-neutral-400">— {r.source}</span>}</span>
                  </label>
                ))}
              </div>
            </div>
            <Field label="Additional free-text safety flags"><textarea rows={2} className={`${ta} mt-2`} value={form.safety_free_text} onChange={(e) => set({ safety_free_text: e.target.value })} placeholder="One per line (optional)" /></Field>
          </Section>

          {/* Submit bar */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <button onClick={saveDraftNow} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Save as draft</button>
              <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-700 px-6 py-2 font-medium text-white hover:bg-brand-800 disabled:opacity-50">{submitting ? "Submitting…" : "Submit case"}</button>
            </div>
            <div className="mt-2 text-xs text-neutral-400">{saveIndicator}</div>
          </div>
        </div>
      </div>

      {showPanel && (
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[40%] overflow-hidden rounded-lg border border-neutral-200 bg-white lg:block">
          {sourceArea}
        </aside>
      )}

      {/* Floating: back-to-top (appears after Section 1) + mobile source */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-4 z-30 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-600 shadow hover:bg-neutral-50 lg:bottom-4">
          ↑ Top
        </button>
      )}
      <button onClick={() => setMobileOpen(true)} className="fixed bottom-4 right-4 z-30 rounded-full bg-brand-700 px-4 py-3 text-sm font-medium text-white shadow-lg lg:hidden">Source</button>
      <div className={`fixed inset-0 z-40 transform bg-white transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <button onClick={() => setMobileOpen(false)} className="self-end p-3 text-neutral-500">✕ Close</button>
          <div className="min-h-0 flex-1">{sourceArea}</div>
        </div>
      </div>
    </div>
  );
}
