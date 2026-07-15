// The v1.2.1 three-section form, retained as the "full form" view. Serves
// experienced authors who want form-style editing, the "See full case" modal
// inside the guided flow, and anyone who prefers seeing the whole case shape.
// It edits the same FormState as the guided flow, so the two views never
// diverge.

import { useState } from "react";
import type { FormState } from "../caseForm";
import { lines, truncate, safetyAnswered } from "../caseForm";
import { Field, ArchetypePicker } from "./fields";
import { GuidanceIcon } from "./GuidancePopover";
import { QUERY_GUIDANCE, TIER_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE, ARCHETYPE_GUIDANCE, PROVENANCE_GUIDANCE } from "../guidance";

type SectionStatus = "Not started" | "In progress" | "Filled";
const BADGE: Record<SectionStatus, string> = {
  "Not started": "bg-neutral-100 text-neutral-500",
  "In progress": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  Filled: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
};

function Section({ num, title, subtitle, status, summary, open, onToggle, children }: {
  num: number; title: string; subtitle: string; status: SectionStatus; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section className="cg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 rounded-lg px-5 py-4 text-left transition-colors hover:bg-neutral-50">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-serif text-xs font-semibold text-neutral-500">{num}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-base font-semibold text-neutral-900">{title}</span>
          <span className="block truncate text-xs text-neutral-400">{open ? subtitle : summary}</span>
        </span>
        <span className={`cg-badge shrink-0 ${BADGE[status]}`}>{status}</span>
        <svg className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && <div className="border-t border-neutral-100 px-5 py-5">{children}</div>}
    </section>
  );
}

function statusOf(vals: string[]): SectionStatus {
  const filled = vals.filter((v) => v.trim()).length;
  if (filled === 0) return "Not started";
  if (filled === vals.length) return "Filled";
  return "In progress";
}

// "+ add" reveal control for optional tiers.
function AddTier({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium text-brand-700 transition-colors hover:text-brand-800">
      + Add {label}
    </button>
  );
}

// Required-always tier; Expected/Situational revealed on demand (or already
// containing content — e.g. filled through the guided flow).
function TierGroup({ prefix, form, set, revealed, reveal }: {
  prefix: "inv" | "tx";
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  revealed: Record<string, boolean>;
  reveal: (k: string) => void;
}) {
  const rk = `${prefix}_required` as keyof FormState;
  const ek = `${prefix}_expected` as keyof FormState;
  const sk = `${prefix}_situational` as keyof FormState;
  const showE = revealed[ek as string] || !!(form[ek] as string).trim();
  const showS = revealed[sk as string] || !!(form[sk] as string).trim();
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-neutral-600">Required</div>
      <textarea rows={2} className="cg-textarea" value={form[rk] as string} onChange={(e) => set({ [rk]: e.target.value } as Partial<FormState>)} placeholder="One item per line" />

      {showE && (
        <div className="mt-3">
          <div className="mb-1 text-sm font-medium text-neutral-600">Expected</div>
          <textarea rows={2} className="cg-textarea" value={form[ek] as string} onChange={(e) => set({ [ek]: e.target.value } as Partial<FormState>)} placeholder="One item per line" />
        </div>
      )}

      {showS && (
        <div className="mt-3">
          <div className="mb-1 flex items-center text-sm font-medium text-neutral-600">Situational<GuidanceIcon title="Situational triggers" text={TRIGGER_GUIDANCE} /></div>
          <p className="cg-help mb-1">Format: [item] — trigger: [trigger condition]</p>
          <textarea rows={2} className="cg-textarea" value={form[sk] as string} onChange={(e) => set({ [sk]: e.target.value } as Partial<FormState>)} placeholder="CSF analysis — trigger: AI raises meningitis as a differential" />
        </div>
      )}

      {(!showE || !showS) && (
        <div className="mt-2 flex gap-4">
          {!showE && <AddTier label="expected" onClick={() => reveal(ek as string)} />}
          {!showS && <AddTier label="situational" onClick={() => reveal(sk as string)} />}
        </div>
      )}
    </div>
  );
}

export function FullForm({ form, set, toggleArchetype, onSubmit, submitting }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  // Collapsed by default except the first section.
  const [sectionsOpen, setSectionsOpen] = useState<Record<number, boolean>>(() => {
    try { return { 1: true, 2: false, 3: false, ...JSON.parse(sessionStorage.getItem("cg_sections2") || "{}") }; }
    catch { return { 1: true, 2: false, 3: false }; }
  });
  const toggleSection = (n: number) => setSectionsOpen((p) => {
    const next = { ...p, [n]: !p[n] };
    sessionStorage.setItem("cg_sections2", JSON.stringify(next));
    return next;
  });
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const reveal = (k: string) => setRevealed((p) => ({ ...p, [k]: true }));

  const s1Status = statusOf([form.archetypes.length || form.other_checked ? "x" : "", form.query, form.what_this_evaluates, form.query_scope, form.provenance_notes]);
  const s2Status = statusOf([form.primary, form.critical_differentials, form.other_considerations, form.inv_required, form.inv_expected, form.inv_situational, form.tx_required, form.tx_expected, form.tx_situational, form.complications, form.mon_required, form.mon_expected, form.escalation]);
  const s3Status: SectionStatus = safetyAnswered(form) ? "Filled" : "Not started";

  const s2Count = [form.primary, form.critical_differentials, form.other_considerations, form.inv_required, form.inv_expected, form.inv_situational, form.tx_required, form.tx_expected, form.tx_situational, form.complications, form.mon_required, form.mon_expected, form.escalation]
    .reduce((a, v) => a + lines(v).length, 0);
  const s1Summary = form.query ? `"${truncate(form.query, 56)}"` : "What the case is about and what reasoning it tests";
  const s2Summary = form.primary ? `${truncate(form.primary, 36)} · ${s2Count} item${s2Count === 1 ? "" : "s"}` : "What a competent AI should address";
  const s3Summary = form.safety_none_declared
    ? "No danger-level constraints declared"
    : lines(form.safety_harm_text).length
      ? `${lines(form.safety_harm_text).length} constraint${lines(form.safety_harm_text).length === 1 ? "" : "s"}`
      : "What must the AI never do, or never leave out";

  return (
    <div className="space-y-3">
      <Section num={1} title="Frame the case" subtitle="What the case is about and what reasoning it tests" status={s1Status} summary={s1Summary} open={!!sectionsOpen[1]} onToggle={() => toggleSection(1)}>
        {/* No "authored by" field (ADR-030) — identity comes from the
            logged-in session, shown in the page header. */}
        <Field label="Reasoning patterns this case exercises" guidance={{ title: "Reasoning patterns", text: ARCHETYPE_GUIDANCE }} hint="Optional. Pick these first, then write a query that exercises them.">
          <ArchetypePicker form={form} set={set} toggleArchetype={toggleArchetype} />
        </Field>

        <Field label="Clinical query" guidance={{ title: "Writing the clinical query", text: QUERY_GUIDANCE }}>
          <textarea rows={3} className="cg-textarea" value={form.query} onChange={(e) => set({ query: e.target.value })} placeholder="A realistic clinical scenario — 1-3 sentences ending in scope." />
        </Field>
        <Field label="What this case evaluates" guidance={{ title: "What this case evaluates", text: WHAT_THIS_EVALUATES_GUIDANCE }}>
          <textarea rows={2} className="cg-textarea" value={form.what_this_evaluates} onChange={(e) => set({ what_this_evaluates: e.target.value })} placeholder="Optional but recommended." />
        </Field>
        <Field label="Query scope" hint="Optional."><input className="cg-input" value={form.query_scope} onChange={(e) => set({ query_scope: e.target.value })} placeholder="e.g. diagnosis + initial management; excludes long-term follow-up" /></Field>
        <Field label="Provenance notes" guidance={{ title: "Provenance notes", text: PROVENANCE_GUIDANCE }} hint="Two sentences: what traces to the guideline, and what is authored from clinical judgment or another standard. This tells a reviewer what to verify against what. Not a decision journal.">
          <textarea rows={2} className="cg-textarea" value={form.provenance_notes} onChange={(e) => set({ provenance_notes: e.target.value })} placeholder="TB diagnosis and regimen from NSTG. HIV co-management (cotrimoxazole, CD4, coordinated ART) from WHO TB-HIV guidance, which NSTG doesn't cover." />
        </Field>
      </Section>

      <Section num={2} title="Author the expected response" subtitle="What a competent AI should address" status={s2Status} summary={s2Summary} open={!!sectionsOpen[2]} onToggle={() => toggleSection(2)}>
        <div className="space-y-6">
          <div>
            <h3 className="cg-eyebrow mb-2">Expected diagnoses</h3>
            <Field label="Primary diagnosis"><input className="cg-input" value={form.primary} onChange={(e) => set({ primary: e.target.value })} placeholder="The diagnosis the AI should reach (kept out of the query)." /></Field>
            <Field label="Critical differentials" hint="Differentials the AI must consider."><textarea rows={2} className="cg-textarea" value={form.critical_differentials} onChange={(e) => set({ critical_differentials: e.target.value })} placeholder="One per line" /></Field>
            <Field label="Other considerations the AI should address"><textarea rows={2} className="cg-textarea" value={form.other_considerations} onChange={(e) => set({ other_considerations: e.target.value })} placeholder="One per line" /></Field>
          </div>

          <div>
            <h3 className="cg-eyebrow mb-2 flex items-center">Investigations<GuidanceIcon title="Tier categories" text={TIER_GUIDANCE} /></h3>
            <TierGroup prefix="inv" form={form} set={set} revealed={revealed} reveal={reveal} />
          </div>

          <div>
            <h3 className="cg-eyebrow mb-2 flex items-center">Treatments<GuidanceIcon title="Tier categories" text={TIER_GUIDANCE} /></h3>
            <TierGroup prefix="tx" form={form} set={set} revealed={revealed} reveal={reveal} />
          </div>

          <div>
            <Field label="Complications the AI should address"><textarea rows={2} className="cg-textarea" value={form.complications} onChange={(e) => set({ complications: e.target.value })} placeholder="One complication per line" /></Field>
          </div>

          <div>
            <h3 className="cg-eyebrow mb-2">Monitoring &amp; escalation</h3>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Monitoring — required"><textarea rows={2} className="cg-textarea" value={form.mon_required} onChange={(e) => set({ mon_required: e.target.value })} placeholder="One per line" /></Field>
              <Field label="Monitoring — expected"><textarea rows={2} className="cg-textarea" value={form.mon_expected} onChange={(e) => set({ mon_expected: e.target.value })} placeholder="One per line" /></Field>
            </div>
            <Field label="Escalation triggers" hint="One per line: [finding] — [escalation action]. Flat — a finding either warrants escalation or it does not.">
              <textarea rows={2} className="cg-textarea" value={form.escalation} onChange={(e) => set({ escalation: e.target.value })} placeholder="Rifampicin resistance on GeneXpert — escalate to MDR-TB pathway" />
            </Field>
          </div>
        </div>
      </Section>

      <Section num={3} title="Safety" subtitle="What must the AI never do, or never leave out" status={s3Status} summary={s3Summary} open={!!sectionsOpen[3]} onToggle={() => toggleSection(3)}>
        <h3 className="cg-eyebrow">What must the AI never do, or never leave out, because it would harm this patient?</h3>
        <p className="cg-help mt-1">List only things that would cause real harm — a dangerous action the AI must not take, or a critical step it must not omit. Everyday best-practice or "better choice" issues do not belong here; those belong in the response above.</p>
        <div className="mt-3">
          <textarea rows={3} className="cg-textarea" value={form.safety_harm_text} onChange={(e) => set({ safety_harm_text: e.target.value })} placeholder="One per line — e.g. Insulin should not be initiated without first confirming serum potassium above 3.3 mmol/L" />
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
          <input type="checkbox" checked={form.safety_none_declared} onChange={(e) => set({ safety_none_declared: e.target.checked })} className="mt-0.5 accent-brand-700" />
          <span>No danger-level constraints apply to this patient.</span>
        </label>
      </Section>

      {/* Submit bar — saving is automatic (indicator lives in the page header). */}
      <div className="cg-card flex items-center justify-end p-4">
        <button onClick={onSubmit} disabled={submitting} className="cg-btn-primary px-6">{submitting ? "Submitting…" : "Submit case"}</button>
      </div>
    </div>
  );
}
