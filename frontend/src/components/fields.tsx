// Shared authoring field atoms. Both the guided flow and the full form render
// these, so the two views stay visually and behaviorally identical.

import { useState } from "react";
import type { FormState, RuleInfo } from "../caseForm";
import { GuidanceIcon, renderGuidance } from "./GuidancePopover";
import { SeverityBadge } from "./ui";
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

export function SafetyRuleList({ rules, selectedIds, toggleRule }: {
  rules: RuleInfo[];
  selectedIds: number[];
  toggleRule: (id: number) => void;
}) {
  if (rules.length === 0) return <p className="text-sm text-neutral-400">No verified safety rules recorded for the selected condition(s).</p>;
  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <label key={r.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-3 text-sm transition-colors hover:bg-neutral-50">
          <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleRule(r.id)} className="mt-0.5 accent-brand-700" />
          <span className="text-neutral-700">
            <SeverityBadge severity={r.severity} /> {r.description}{" "}
            {r.source && <span className="text-xs text-neutral-400">— {r.source}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

// A dismissable modal that renders long guidance text (same markdown subset as
// GuidancePopover) — used for "Learn more about safety rules".
export function TextModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between">
          <h3 className="font-serif text-lg font-semibold text-neutral-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Close">✕</button>
        </div>
        {renderGuidance(text)}
      </div>
    </div>
  );
}

// Collapsible worked example under a question ("Show an example").
export function ExampleToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="cg-link text-xs">
        {open ? "Hide example" : "Show an example"}
      </button>
      {open && (
        <p className="mt-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2.5 text-sm italic leading-relaxed text-neutral-600">
          {text}
        </p>
      )}
    </div>
  );
}
