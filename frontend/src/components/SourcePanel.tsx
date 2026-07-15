// Read-only panel showing the structured NSTG source material the MD authors
// from. Renders the extract_skeleton shape directly — no LLM annotation.

import { useState } from "react";
import type { SourceMaterial } from "../types";
import { Spinner, ErrorBox } from "./ui";

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

// The guideline's introduction for the condition — collapsed by default so it
// doesn't push the structured data below the fold.
function IntroBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
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

export function SourcePanel({ data, loading, error }: { data: SourceMaterial | null; loading: boolean; error: string | null }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Source material from NSTG</h2>
        {data?.scoped_to_subtype && (
          <p className="mt-0.5 text-xs text-slate-500">Scoped to: {data.scoped_to_subtype}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4"><Spinner label="Loading source material…" /></div>}
        {error && <div className="p-4"><ErrorBox message={error} /></div>}

        {data && (
          <>
            {data.condition.introduction && (
              <div className="border-b border-slate-200">
                <IntroBlock text={data.condition.introduction} />
              </div>
            )}

            <Collapsible title="Findings" count={Object.values(data.findings.by_subtype).flat().length}>
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

            <Collapsible title="Investigations" count={data.investigations_pool.items.length}>
              <PlainList items={data.investigations_pool.items} />
            </Collapsible>

            <Collapsible title="Treatments" count={Object.values(data.treatments_pool.by_type).flat().length}>
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

            <Collapsible title="Differentials" count={data.differentials_pool.items.length}>
              <PlainList items={data.differentials_pool.items} />
            </Collapsible>

            <Collapsible title="Complications" count={data.complications_pool.items.length}>
              <PlainList items={data.complications_pool.items} />
            </Collapsible>

            <Collapsible
              title="Safety signals"
              count={data.safety_signals.adverse_reactions_from_nstg.length}
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
