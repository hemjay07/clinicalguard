// Shared authoring field atoms. Both the guided flow and the full form render
// these, so the two views stay visually and behaviorally identical.

import type { FormState } from "../caseForm";
import { GuidanceIcon } from "./GuidancePopover";
import { ARCHETYPES } from "../guidance";

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

export function ArchetypePicker({ form, set, toggleArchetype }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {ARCHETYPES.map((a) => (
          <label key={a.value} className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
            <input type="checkbox" checked={form.archetypes.includes(a.value)} onChange={() => toggleArchetype(a.value)} className="mt-0.5 accent-brand-700" />
            <span><span className="font-medium text-neutral-800">{a.label}</span><span className="mt-0.5 block text-xs leading-snug text-neutral-400">{a.subtitle}</span></span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
          <input type="checkbox" checked={form.other_checked} onChange={(e) => set({ other_checked: e.target.checked })} className="mt-0.5 accent-brand-700" />
          <span className="font-medium text-neutral-800">Other (specify)</span>
        </label>
      </div>
      {form.other_checked && <input className="cg-input mt-3" value={form.other_text} onChange={(e) => set({ other_text: e.target.value })} placeholder="Describe the reasoning pattern" />}
    </>
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
