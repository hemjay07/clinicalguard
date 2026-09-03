// The guided authoring flow (default view): the case as a journey through the
// three phases, one clinical question per screen. Navigation is free — phase
// names, breadcrumb dots, and arrows all jump anywhere; answers persist via
// the shared FormState + autosave in the Authoring shell.

import type { FormState, ValidationIssue } from "../caseForm";
import { SAFETY_PROMPT } from "../caseForm";
import { useState } from "react";
import {
  PHASES, phaseScreens, screenFilled, screenSummary,
  FLOW_STEPS, phaseSteps, stepIndexForScreen, enrichmentTarget,
} from "../flow";
import type { ScreenDef, FlowStep } from "../flow";
import { ArchetypePicker, InlineExample } from "./fields";
import { GuidanceIcon } from "./GuidancePopover";
import { QUERY_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE, ARCHETYPE_GUIDANCE, PROVENANCE_GUIDANCE, QUERY_EXAMPLE } from "../guidance";

interface Props {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  screenId: string;
  goTo: (id: string) => void;
  toggleArchetype: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  issues: ValidationIssue[];
}

// --- phase bar ---------------------------------------------------------------

function PhaseBar({ current, goTo, form }: { current: FlowStep; goTo: (id: string) => void; form: FormState }) {
  return (
    <div className="px-1">
      <div className="grid grid-cols-3 gap-2">
        {PHASES.map((p) => {
          const steps = phaseSteps(p.n);
          const isCurrent = p.n === current.phase;
          const isPast = p.n < current.phase;
          // Position within the phase (progress line shows position, not completion).
          const posInPhase = isCurrent ? steps.findIndex((st) => st.id === current.id) + 1 : 0;
          const frac = isPast ? 1 : isCurrent ? posInPhase / steps.length : 0;
          return (
            <button key={p.n} type="button" onClick={() => goTo(steps[0].id)} className="group min-w-0 rounded-lg px-1 py-1 text-left transition-colors hover:bg-neutral-50">
              <span className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-serif text-[11px] font-semibold transition-colors ${
                  isCurrent ? "bg-brand-700 text-white" : isPast ? "bg-brand-100 text-brand-700" : "bg-neutral-100 text-neutral-400"
                }`}>
                  {isPast ? "✓" : p.n}
                </span>
                {/* On phones only the current phase carries its name — the
                    truncated labels of the other two were noise, their
                    numbered circles are enough to jump by. */}
                <span className={`truncate text-xs font-medium sm:text-sm ${
                  isCurrent ? "text-neutral-900" : "hidden text-neutral-400 group-hover:text-neutral-600 sm:block"
                }`}>
                  {p.title}
                </span>
              </span>
              <span className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <span className="block h-full rounded-full bg-brand-600 transition-all duration-300 ease-out" style={{ width: `${frac * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Breadcrumb dots for the current phase — clickable, show fill state.
          The enrichment group gets a "+" dot so optional depth is visible from
          the bar itself, not only once you reach the end of the phase. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {phaseSteps(current.phase).map((st) => {
          const active = st.id === current.id;
          const filled = st.kind === "screen"
            ? screenFilled(st.screen.kind, form)
            : st.screens.some((s) => screenFilled(s.kind, form));
          const label = st.kind === "screen" ? st.screen.id.split(".")[1] : "+";
          const title = st.kind === "screen"
            ? `${st.screen.id} — ${st.screen.crumb}`
            : `More detail — ${st.screens.length} optional questions`;
          return (
            <button
              key={st.id}
              type="button"
              title={title}
              onClick={() => goTo(st.id)}
              className={`h-6 min-w-6 rounded-full px-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-brand-700 text-white"
                  : filled
                    ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100"
                    : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- per-screen bodies ---------------------------------------------------------

const SITUATIONAL_PLACEHOLDER: Record<string, string> = {
  inv_situational: "CT abdomen — trigger: AI raises peritoneal signs or suspected surgical abdomen",
  tx_situational: "IV sodium bicarbonate — trigger: AI raises severe acidosis with pH < 7.0",
};

function ScreenBody({ screen, form, set, toggleArchetype, onEnter, showSafetyPrompt }: {
  screen: ScreenDef;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  onEnter: () => void;
  showSafetyPrompt: boolean;
}) {
  const inputProps = (key: keyof FormState, placeholder: string) => ({
    className: "cg-input",
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value } as Partial<FormState>),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } },
    placeholder,
  });
  const textareaProps = (key: keyof FormState, rows: number, placeholder: string) => ({
    rows,
    className: "cg-textarea",
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ [key]: e.target.value } as Partial<FormState>),
    placeholder,
  });

  switch (screen.kind) {
    case "archetypes":
      return (
        <div>
          <ArchetypePicker form={form} set={set} toggleArchetype={toggleArchetype} />
          <div className="mt-3"><GuidanceIcon title="Reasoning patterns" text={ARCHETYPE_GUIDANCE} /> <span className="text-xs text-neutral-400">More on reasoning patterns</span></div>
        </div>
      );
    case "query":
      return (
        <div>
          <textarea {...textareaProps("query", 5, "A realistic clinical scenario — 1-3 sentences ending in scope.")} autoFocus />
          <InlineExample text={QUERY_EXAMPLE} />
          <div className="mt-2"><GuidanceIcon title="Writing the clinical query" text={QUERY_GUIDANCE} /> <span className="text-xs text-neutral-400">Full guidance on writing queries</span></div>
        </div>
      );
    case "evaluates":
      return (
        <div>
          <textarea {...textareaProps("what_this_evaluates", 3, "e.g. Tests recognition of DKA precipitated by infection in a young T1DM patient…")} />
          <div className="mt-2"><GuidanceIcon title="What this case evaluates" text={WHAT_THIS_EVALUATES_GUIDANCE} /> <span className="text-xs text-neutral-400">Why this matters</span></div>
        </div>
      );
    case "scope":
      return <input {...inputProps("query_scope", "e.g. diagnosis and initial management; excludes long-term glycaemic control planning")} />;
    case "provenance":
      return (
        <div>
          <textarea {...textareaProps("provenance_notes", 3, "TB diagnosis and regimen from NSTG. HIV co-management (cotrimoxazole, CD4, coordinated ART) from WHO TB-HIV guidance, which NSTG doesn't cover.")} />
          <div className="mt-2"><GuidanceIcon title="Provenance notes" text={PROVENANCE_GUIDANCE} /> <span className="text-xs text-neutral-400">Why provenance matters</span></div>
        </div>
      );
    case "primary":
      return <input {...inputProps("primary", "The diagnosis the AI should reach")} autoFocus />;
    case "critical_differentials":
      return <textarea {...textareaProps("critical_differentials", 3, "One per line — e.g. Hyperosmolar hyperglycaemic state (HHS)")} />;
    case "other_considerations":
      return <textarea {...textareaProps("other_considerations", 3, "One per line — e.g. Identification and treatment of the precipitating cause")} />;
    case "inv_required":
      return <textarea {...textareaProps("inv_required", 3, "One per line — e.g. Venous or arterial blood gas")} />;
    case "inv_expected":
      return <textarea {...textareaProps("inv_expected", 3, "One per line — e.g. Serum ketones (beta-hydroxybutyrate)")} />;
    case "tx_required":
      return <textarea {...textareaProps("tx_required", 3, "One per line — e.g. IV fluid resuscitation with 0.9% normal saline initiated first, before insulin")} />;
    case "tx_expected":
      return <textarea {...textareaProps("tx_expected", 3, "One per line — e.g. Change to 5% dextrose-containing fluid when blood glucose falls below 14 mmol/L")} />;
    case "inv_situational":
    case "tx_situational": {
      const key = screen.kind as "inv_situational" | "tx_situational";
      return (
        <div>
          <p className="cg-help mb-1.5">Format: [item] — trigger: [what the AI raises that activates the requirement]</p>
          <textarea {...textareaProps(key, 3, SITUATIONAL_PLACEHOLDER[key])} />
          <div className="mt-2"><GuidanceIcon title="Situational triggers" text={TRIGGER_GUIDANCE} /> <span className="text-xs text-neutral-400">How triggers are scored</span></div>
        </div>
      );
    }
    case "complications":
      return <textarea {...textareaProps("complications", 3, "One per line — e.g. Cerebral edema (rare but catastrophic; particularly in young patients)")} />;
    case "monitoring":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="cg-label">Required</div>
            <textarea {...textareaProps("mon_required", 4, "One per line — e.g. Hourly vital signs")} />
          </div>
          <div>
            <div className="cg-label">Expected</div>
            <textarea {...textareaProps("mon_expected", 4, "One per line — e.g. Temperature monitoring for infection precipitant tracking")} />
          </div>
        </div>
      );
    case "escalation":
      return (
        <div>
          <p className="cg-help mb-1.5">Format: [finding] — [escalation action]</p>
          <textarea {...textareaProps("escalation", 4, "Rifampicin resistance on GeneXpert — escalate to MDR-TB pathway")} />
        </div>
      );
    case "safety_harm": {
      const checked = form.safety_none_declared;
      return (
        <div>
          <textarea
            {...textareaProps("safety_harm_text", 4, "One per line — e.g. Insulin should not be initiated without first confirming serum potassium above 3.3 mmol/L")}
            autoFocus
          />
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => set({ safety_none_declared: e.target.checked })}
              className="mt-0.5 accent-brand-700"
            />
            <span>No danger-level constraints apply to this patient.</span>
          </label>
          {showSafetyPrompt && (
            <p className="mt-3 text-sm text-amber-700">{SAFETY_PROMPT}</p>
          )}
        </div>
      );
    }
    case "review":
      return null; // rendered by ReviewScreen
  }
}

// --- enrichment group ----------------------------------------------------------
// One step per phase holding that phase's optional questions. Deliberately a
// full, inviting panel rather than a grey link: if physicians never open it we
// get thin skeleton-only cases and a weak corpus. Each question is one tap to
// open, and answered ones start open so returning shows your work.

const ENRICHMENT_NUDGE: Record<number, string> = {
  1: "Optional. A line on what the case is testing, and its scope, help the next reader use it well.",
  2: "Optional, but expected and situational items, monitoring, and complications make a case much stronger.",
};

function EnrichmentRow({ screen, form, set, toggleArchetype, defaultOpen }: {
  screen: ScreenDef;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const filled = screenFilled(screen.kind, form);
  const summary = screenSummary(screen.kind, form);

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-1 py-3.5 text-left transition-colors hover:bg-neutral-50"
      >
        <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${filled ? "bg-brand-500" : "bg-neutral-300"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">{screen.crumb}</span>
          <span className={`block truncate text-xs ${filled ? "text-neutral-500" : "text-neutral-400"}`}>
            {summary || "Not added"}
          </span>
        </span>
        <span className="shrink-0 text-lg leading-none text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-1 pb-5">
          <h3 className="font-serif text-base font-semibold leading-snug text-neutral-900">{screen.question}</h3>
          {screen.help && <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-neutral-500">{screen.help}</p>}
          <div className="mt-3.5">
            <ScreenBody
              screen={screen}
              form={form}
              set={set}
              toggleArchetype={toggleArchetype}
              onEnter={() => {}}
              showSafetyPrompt={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EnrichmentGroup({ screens, phase, form, set, toggleArchetype, openId }: {
  screens: ScreenDef[];
  phase: 1 | 2 | 3;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  openId: string | null;
}) {
  const answered = screens.filter((s) => screenFilled(s.kind, form)).length;
  return (
    <div>
      <p className="text-sm leading-relaxed text-neutral-600">{ENRICHMENT_NUDGE[phase]}</p>
      <p className="mt-3 text-xs font-medium text-neutral-400">
        {answered > 0 ? `${answered} of ${screens.length} added` : `${screens.length} optional questions`}
        {" · tap any to add"}
      </p>
      <div className="mt-3 border-t border-neutral-100">
        {screens.map((s) => (
          <EnrichmentRow
            key={s.id}
            screen={s}
            form={form}
            set={set}
            toggleArchetype={toggleArchetype}
            defaultOpen={s.id === openId || screenFilled(s.kind, form)}
          />
        ))}
      </div>
    </div>
  );
}

// --- review screen -------------------------------------------------------------

function ReviewScreen({ form, goTo, issues }: {
  form: FormState;
  goTo: (id: string) => void;
  issues: ValidationIssue[];
}) {
  return (
    <div>
      {issues.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="mb-1 font-medium">Please fix before submitting:</p>
          <ul className="space-y-1">
            {issues.map((iss, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span>{iss.message}</span>
                {iss.screenId && (
                  <button type="button" onClick={() => goTo(iss.screenId!)} className="shrink-0 text-xs font-medium underline hover:no-underline">Fix</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {PHASES.map((p) => (
          <div key={p.n} className="cg-card">
            <div className="border-b border-neutral-100 px-4 py-2.5">
              <span className="cg-eyebrow">Phase {p.n} · {p.title}</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {phaseScreens(p.n).filter((s) => s.kind !== "review").map((s) => {
                const summary = screenSummary(s.kind, form);
                return (
                  <button key={s.id} type="button" onClick={() => goTo(s.id)}
                    className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50">
                    <span className="w-44 shrink-0 text-xs font-medium text-neutral-500">{s.crumb}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${summary ? "text-neutral-800" : "italic text-neutral-300"}`}>
                      {summary || (s.optional ? "Not provided (optional)" : "Not provided")}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-brand-700">Edit</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- the flow ------------------------------------------------------------------

export function GuidedFlow({ form, set, screenId, goTo, toggleArchetype, onSubmit, submitting, issues }: Props) {
  // The flow walks FLOW_STEPS (core screens + one grouped enrichment step per
  // phase), not the raw 19. A ?screen= pointing at an enrichment question
  // resolves to its group with that question already open.
  const idx = stepIndexForScreen(screenId);
  const step = FLOW_STEPS[idx];
  const openId = enrichmentTarget(screenId);
  const screen = step.kind === "screen" ? step.screen : null;
  const showSafetyPrompt = !!screen && issues.some((i) => i.screenId === screen.id);

  const goNext = () => { if (idx < FLOW_STEPS.length - 1) goTo(FLOW_STEPS[idx + 1].id); };
  const goBack = () => { if (idx > 0) goTo(FLOW_STEPS[idx - 1].id); };
  const isReview = screen?.kind === "review";

  return (
    <div className="space-y-5">
      <PhaseBar current={step} goTo={goTo} form={form} />

      {/* key= remounts on navigation so the enter animation replays and
          per-screen local state (accordion rows, learn-more) resets. */}
      <div key={step.id} className="cg-screen-enter cg-card px-5 py-7 sm:px-10 sm:py-9">
        {/* No eyebrow: the phase bar + dots directly above already say where
            the author is — repeating it here was pure noise. */}
        {step.kind === "enrichment" ? (
          <>
            <h2 className="font-serif text-2xl font-semibold leading-snug text-neutral-900">Add more detail</h2>
            <p className="mt-1.5 text-sm font-medium text-brand-700">Optional — your case is already valid without this</p>
            <div className="mt-6">
              <EnrichmentGroup
                screens={step.screens}
                phase={step.phase}
                form={form}
                set={set}
                toggleArchetype={toggleArchetype}
                openId={openId}
              />
            </div>
          </>
        ) : (
          <>
            {screen!.lead && <p className="mb-3 max-w-prose text-sm leading-relaxed text-neutral-600">{screen!.lead}</p>}
            <h2 className="font-serif text-2xl font-semibold leading-snug text-neutral-900">{screen!.question}</h2>
            {screen!.help && <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-neutral-500">{screen!.help}</p>}

            <div className="mt-6">
              {isReview ? (
                <ReviewScreen form={form} goTo={goTo} issues={issues} />
              ) : (
                <ScreenBody screen={screen!} form={form} set={set} toggleArchetype={toggleArchetype} onEnter={goNext} showSafetyPrompt={showSafetyPrompt} />
              )}
            </div>
          </>
        )}

        {/* One navigation row: Back on the left, the single forward action on
            the right. Optional questions are skipped by pressing Next. */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
          <button type="button" onClick={goBack} disabled={idx === 0} className="cg-btn-ghost -ml-2" aria-label="Previous question">
            ← Back
          </button>
          {!isReview ? (
            <button type="button" onClick={goNext} className="cg-btn-primary px-6" aria-label="Next question">
              {idx === FLOW_STEPS.length - 2 ? "Review case →" : "Next →"}
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={submitting} className="cg-btn-primary px-6">
              {submitting ? "Submitting…" : "Submit case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
