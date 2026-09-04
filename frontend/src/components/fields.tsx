// Shared authoring field atoms. Both the guided flow and the full form render
// these, so the two views stay visually and behaviorally identical.

import type { FormState } from "../caseForm";
import { provenanceRequiresNotes } from "../guidance";
import { GuidanceIcon } from "./GuidancePopover";
import { ARCHETYPES, PROVENANCE_TIERS, PROVENANCE_GUIDANCE } from "../guidance";

export function Field({ label, guidance, hint, children }: { label: string; guidance?: { title: string; text: string }; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="cg-label flex items-center">
        {label}
        {guidance && <GuidanceIcon title={guidance.title} text={guidance.text} />}
      </label>
      {hint && <p className="cg-help -mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

// One column, on every width. The two-column grid halved the scroll but made
// each option a two-line fragment the eye had to reassemble; these are whole
// sentences and want to be read as a list. The framework's short names for
// the patterns are deliberately absent (v1.6 §3) — they belong to the corpus,
// not to the person answering.
export function ArchetypePicker({ form, set, toggleArchetype }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2.5">
        {ARCHETYPES.map((a) => (
          <label key={a.value} className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
            <input type="checkbox" checked={form.archetypes.includes(a.value)} onChange={() => toggleArchetype(a.value)} className="mt-0.5 accent-brand-700" />
            <span>{a.plain}</span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
          <input type="checkbox" checked={form.other_checked} onChange={(e) => set({ other_checked: e.target.checked })} className="mt-0.5 accent-brand-700" />
          <span>Something else (describe it)</span>
        </label>
      </div>
      {form.other_checked && <input className="cg-input mt-3" value={form.other_text} onChange={(e) => set({ other_text: e.target.value })} placeholder="Describe it" />}
    </>
  );
}

// The provenance tier (ADR-033) plus the notes it makes necessary. No default
// selection: a pre-ticked answer to "where did this come from?" reads as
// answered when it isn't. The notes textarea appears only for the two tiers
// that claim something came from outside NSTG, which are the only two a
// reviewer cannot check without being told which parts.
export function ProvenancePicker({ form, set, showPrompt }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  showPrompt?: boolean;
}) {
  const needsNotes = provenanceRequiresNotes(form.guideline_provenance);
  return (
    <div>
      <div className="space-y-2.5">
        {PROVENANCE_TIERS.map((t) => (
          <label key={t.value} className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
            <input
              type="radio"
              name="guideline_provenance"
              checked={form.guideline_provenance === t.value}
              onChange={() => set({ guideline_provenance: t.value })}
              className="mt-0.5 accent-brand-700"
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {needsNotes && (
        <div className="mt-4">
          <div className="cg-label">Which parts, and from where? One or two sentences.</div>
          <textarea
            rows={3}
            className="cg-textarea"
            value={form.provenance_notes}
            onChange={(e) => set({ provenance_notes: e.target.value })}
            placeholder="e.g. TB regimen from NSTG; HIV co-management from WHO TB-HIV guidance, which NSTG doesn't cover."
          />
        </div>
      )}

      {showPrompt && (
        <p className="mt-3 text-sm text-amber-700">
          {form.guideline_provenance
            ? "Say which parts came from where, in a sentence or two."
            : "Say where this answer came from before submitting."}
        </p>
      )}

      <div className="mt-3">
        <GuidanceIcon title="Why provenance matters" text={PROVENANCE_GUIDANCE} />{" "}
        <span className="text-xs text-neutral-400">Why this matters</span>
      </div>
    </div>
  );
}

// Worked example shown inline under a question. Previously hidden behind a
// "Show an example" toggle — a physician tester never found it, so the example
// now sits at the point of confusion rather than behind a discovery step.
export function InlineExample({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="text-xs font-medium text-neutral-500">Example</div>
      <p className="mt-1 text-sm italic leading-relaxed text-neutral-600">{text}</p>
    </div>
  );
}
