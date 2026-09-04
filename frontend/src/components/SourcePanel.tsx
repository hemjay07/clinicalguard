// Read-only panel showing the structured NSTG source material the MD authors
// from. Renders the extract_skeleton shape directly — no LLM annotation.

import { useState } from "react";
import type { SourceMaterial } from "../types";
import type { ScreenKind } from "../flow";
import { Spinner, ErrorBox } from "./ui";

export type SourceSection =
  | "intro" | "findings" | "investigations" | "treatments"
  | "differentials" | "complications" | "safety";

// Which parts of the guideline are worth having open for the question on
// screen. Everything stays expandable — this only decides what starts open,
// so the author lands on the relevant section instead of scrolling past five
// collapsed headers to find it. An unmapped screen opens nothing: on the
// opening question, and on anything that describes the case rather than
// answering it, no part of the guideline is more relevant than another.
const SECTIONS_BY_SCREEN: Partial<Record<ScreenKind, SourceSection[]>> = {
  query: ["intro", "findings"],
  primary: ["intro", "findings"],
  critical_differentials: ["intro", "findings"],
  inv_required: ["investigations"],
  inv_expected: ["investigations"],
  inv_situational: ["investigations"],
  tx_required: ["treatments"],
  tx_expected: ["treatments"],
  tx_situational: ["treatments"],
  complications: ["complications", "treatments"],
  monitoring: ["complications", "treatments"],
  escalation: ["findings", "treatments"],
  safety_harm: ["treatments", "safety"],
};

export function sourceSectionsFor(kind: ScreenKind | null): SourceSection[] {
  return (kind && SECTIONS_BY_SCREEN[kind]) || [];
}

function Collapsible({ title, count, children, defaultOpen = true }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span>{title} <span className="text-slate-400">({count})</span></span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-3 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

// The guideline's introduction for the condition.
function IntroBlock({ text, defaultOpen }: { text: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span>NSTG introduction</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="px-4 pb-3 text-sm leading-relaxed text-slate-600">{text}</p>}
    </div>
  );
}

function PlainList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-slate-400">None recorded.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

export function SourcePanel({ data, loading, error, openSections = [], resetKey = "" }: {
  data: SourceMaterial | null;
  loading: boolean;
  error: string | null;
  openSections?: SourceSection[];
  resetKey?: string;
}) {
  const isOpen = (s: SourceSection) => openSections.includes(s);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">From the Nigerian guideline (NSTG)</h2>
        {/* Testers did not realise this panel is specifically what NSTG
            contains, nor that they may add beyond it. Said plainly here; the
            wording matches the provenance screen. */}
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          This is what NSTG says for the selected condition(s). Where it's missing something, add it
          from your clinical judgment or another reference, and note the source.
        </p>
        {data?.scoped_to_subtype && (
          <p className="mt-1 text-xs text-slate-500">Scoped to: {data.scoped_to_subtype}</p>
        )}
      </div>

      {/* resetKey remounts the sections when the author moves screen, so the
          mapping above re-applies. Anything they expanded by hand is theirs
          until they navigate — which is the right lifetime for it. */}
      <div key={resetKey} className="flex-1 overflow-y-auto">
        {loading && <div className="p-4"><Spinner label="Loading source material…" /></div>}
        {error && <div className="p-4"><ErrorBox message={error} /></div>}

        {data && (
          <>
            {data.condition.introduction && (
              <div className="border-b border-slate-200">
                <IntroBlock text={data.condition.introduction} defaultOpen={isOpen("intro")} />
              </div>
            )}

            <Collapsible title="Findings" count={Object.values(data.findings.by_subtype).flat().length} defaultOpen={isOpen("findings")}>
              {Object.keys(data.findings.by_subtype).length === 0 ? (
                <p className="text-slate-400">None recorded.</p>
              ) : (
                Object.entries(data.findings.by_subtype).map(([subtype, items]) => (
                  <div key={subtype} className="mb-2">
                    <div className="text-xs font-medium tracking-wide text-neutral-400">{subtype}</div>
                    <PlainList items={items} />
                  </div>
                ))
              )}
            </Collapsible>

            <Collapsible title="Investigations" count={data.investigations_pool.items.length} defaultOpen={isOpen("investigations")}>
              <PlainList items={data.investigations_pool.items} />
            </Collapsible>

            <Collapsible title="Treatments" count={Object.values(data.treatments_pool.by_type).flat().length} defaultOpen={isOpen("treatments")}>
              {Object.keys(data.treatments_pool.by_type).length === 0 ? (
                <p className="text-slate-400">None recorded.</p>
              ) : (
                Object.entries(data.treatments_pool.by_type).map(([type, items]) => (
                  <div key={type} className="mb-2">
                    <div className="text-xs font-medium tracking-wide text-neutral-400">{type}</div>
                    <PlainList items={items} />
                  </div>
                ))
              )}
            </Collapsible>

            <Collapsible title="Differentials" count={data.differentials_pool.items.length} defaultOpen={isOpen("differentials")}>
              <PlainList items={data.differentials_pool.items} />
            </Collapsible>

            <Collapsible title="Complications" count={data.complications_pool.items.length} defaultOpen={isOpen("complications")}>
              <PlainList items={data.complications_pool.items} />
            </Collapsible>

            <Collapsible
              title="Safety signals"
              count={data.safety_signals.adverse_reactions_from_nstg.length}
              defaultOpen={isOpen("safety")}
            >
              {/* Verified rules are deliberately not surfaced here (ADR-029)
                  — the author answers the harm question in their own words;
                  the framework's internal rule machinery stays invisible. */}
              <div className="text-xs font-medium tracking-wide text-neutral-400">Adverse reactions (NSTG)</div>
              <PlainList items={data.safety_signals.adverse_reactions_from_nstg} />
            </Collapsible>
          </>
        )}
      </div>
    </div>
  );
}
