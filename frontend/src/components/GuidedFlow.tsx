// The guided authoring flow (default view): the case as a journey through the
// three phases, one clinical question per screen. Navigation is free — phase
// names, breadcrumb dots, and arrows all jump anywhere; answers persist via
// the shared FormState + autosave in the Authoring shell.

import type { FormState, ValidationIssue } from "../caseForm";
import { SAFETY_PROMPT } from "../caseForm";
import { useState } from "react";
import {
  PHASES, phaseScreens, screenFilled, screenSummary, screenLabel,
  FLOW_STEPS, phaseSteps, stepIndexForScreen, enrichmentTarget,
  displayNumber, groupScreens, emptyOptional,
} from "../flow";
import type { ScreenDef, FlowStep, OptionalGroup } from "../flow";
import { ArchetypePicker, ProvenancePicker, InlineExample } from "./fields";
import { GuidanceIcon } from "./GuidancePopover";
import { QUERY_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE, ARCHETYPE_GUIDANCE, QUERY_EXAMPLE } from "../guidance";

interface Props {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  screenId: string;
  goTo: (id: string) => void;
  toggleArchetype: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  issues: ValidationIssue[];
  onOpenSource: () => void;
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
                {/* Phones carry all three labels, but the one-word versions —
                    the full titles truncated into noise at that width. */}
                <span className={`truncate text-xs font-medium sm:text-sm ${
                  isCurrent ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-600"
                }`}>
                  <span className="sm:hidden">{p.short}</span>
                  <span className="hidden sm:inline">{p.title}</span>
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
          Numbers come from position in the phase, not from the screen id, so
          they always read 1 2 3 … with no gaps (the ids are stable and out of
          order by design; see flow.ts). The optional menu gets a "+" dot so
          the extra depth is visible from the bar rather than only on arrival. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {phaseSteps(current.phase).map((st) => {
          const active = st.id === current.id;
          const filled = st.kind === "screen"
            ? screenFilled(st.screen.kind, form)
            : st.groups.some((g) => groupScreens(g).some((s) => screenFilled(s.kind, form)));
          const title = st.kind === "screen"
            ? screenLabel(st.screen.kind)
            : "Add more detail — optional";
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
              {displayNumber(st)}
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

// Two worked lines, one of each shape the question asks for: a thing the AI
// must never do, and a thing it must never leave out.
const SAFETY_PLACEHOLDER = `One per line, e.g.
Do not give a beta-blocker in acute decompensated heart failure
Anti-TB drugs are hepatotoxic; do not start them without baseline liver function tests`;

function ScreenBody({ screen, form, set, toggleArchetype, onEnter, showSafetyPrompt, showProvenancePrompt }: {
  screen: ScreenDef;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  onEnter: () => void;
  showSafetyPrompt: boolean;
  showProvenancePrompt?: boolean;
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
          <div className="mt-4"><GuidanceIcon title="Reasoning patterns" text={ARCHETYPE_GUIDANCE} /> <span className="text-xs text-neutral-400">More on these</span></div>
        </div>
      );
    case "query":
      return (
        <div>
          <textarea {...textareaProps("query", 5, "A realistic scenario, 1 to 3 sentences, ending with what you're asking for.")} autoFocus />
          <InlineExample text={QUERY_EXAMPLE} />
          <div className="mt-2"><GuidanceIcon title="Writing the clinical query" text={QUERY_GUIDANCE} /> <span className="text-xs text-neutral-400">Full guidance</span></div>
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
      return <ProvenancePicker form={form} set={set} showPrompt={showProvenancePrompt} />;
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
          <div className="mt-2"><GuidanceIcon title="Situational triggers" text={TRIGGER_GUIDANCE} /> <span className="text-xs text-neutral-400">How triggers are checked</span></div>
        </div>
      );
    }
    case "complications":
      return <textarea {...textareaProps("complications", 3, "One per line — e.g. Cerebral edema (rare but catastrophic; particularly in young patients)")} />;
    case "monitoring":
      // Stacks on a phone: side-by-side, each textarea was too narrow to read
      // a monitoring line in.
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
          <textarea {...textareaProps("safety_harm_text", 5, SAFETY_PLACEHOLDER)} autoFocus />
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => set({ safety_none_declared: e.target.checked })}
              className="mt-0.5 accent-brand-700"
            />
            <span>Nothing here rises to that level for this patient.</span>
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

// --- the optional menu ---------------------------------------------------------
// One step, five named things rather than nine questions. Physicians skipped
// the old list because reading it cost more than answering it; a menu of five
// recognisable groups can be scanned in a second and left alone honestly.
// Each group opens in place, and every field keeps its own guidance verbatim.

function OptionalGroupRow({ group, form, set, toggleArchetype, defaultOpen }: {
  group: OptionalGroup;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const screens = groupScreens(group);
  const answered = screens.filter((s) => screenFilled(s.kind, form)).length;

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-1 py-3.5 text-left transition-colors hover:bg-neutral-50"
      >
        <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${answered ? "bg-brand-500" : "bg-neutral-300"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">{group.title}</span>
          {group.blurb && (
            <span className="mt-0.5 block text-xs leading-snug text-neutral-400">{group.blurb}</span>
          )}
          {answered > 0 && (
            <span className="mt-0.5 block text-xs text-neutral-500">{answered} of {screens.length} added</span>
          )}
        </span>
        <span className="shrink-0 text-lg leading-none text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-5 px-1 pb-5">
          {screens.map((s) => (
            <div key={s.id}>
              <div className="cg-label">{screenLabel(s.kind)}</div>
              {s.help && <p className="cg-help -mt-0.5 mb-1.5">{s.help}</p>}
              <ScreenBody
                screen={s}
                form={form}
                set={set}
                toggleArchetype={toggleArchetype}
                onEnter={() => {}}
                showSafetyPrompt={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionalMenu({ groups, form, set, toggleArchetype, openKey }: {
  groups: OptionalGroup[];
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  toggleArchetype: (value: string) => void;
  openKey: string | null;
}) {
  return (
    <div className="border-t border-neutral-100">
      {groups.map((g) => (
        <OptionalGroupRow
          key={g.key}
          group={g}
          form={form}
          set={set}
          toggleArchetype={toggleArchetype}
          defaultOpen={g.key === openKey || groupScreens(g).some((s) => screenFilled(s.kind, form))}
        />
      ))}
    </div>
  );
}

// --- review screen -------------------------------------------------------------

function ReviewRow({ label, value, missing, onEdit }: {
  label: string; value: string; missing?: boolean; onEdit: () => void;
}) {
  return (
    <button type="button" onClick={onEdit}
      className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50">
      <span className="w-40 shrink-0 text-xs font-medium text-neutral-500 sm:w-52">{label}</span>
      <span className={`min-w-0 flex-1 whitespace-pre-line text-sm ${missing ? "text-red-600" : "text-neutral-800"}`}>
        {missing ? "Not provided" : value}
      </span>
      <span className="shrink-0 text-xs font-medium text-brand-700">Edit</span>
    </button>
  );
}

function ReviewScreen({ form, goTo, issues }: {
  form: FormState;
  goTo: (id: string) => void;
  issues: ValidationIssue[];
}) {
  // Empty optional questions collapse to one line per phase. The old review
  // screen listed all nineteen rows, most of them "Not provided (optional)",
  // which made a perfectly good case look half-finished at the exact moment
  // the author was deciding whether to submit it.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

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
        {PHASES.map((p) => {
          const screens = phaseScreens(p.n).filter((s) => s.kind !== "review");
          const shown = screens.filter((s) => screenFilled(s.kind, form) || !s.optional);
          const hidden = emptyOptional(form, p.n);
          if (shown.length === 0 && hidden.length === 0) return null;
          const isOpen = !!expanded[p.n];
          return (
            <div key={p.n} className="cg-card">
              <div className="border-b border-neutral-100 px-4 py-2.5">
                <span className="cg-eyebrow">Phase {p.n} · {p.title}</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {shown.map((s) => (
                  <ReviewRow
                    key={s.id}
                    label={screenLabel(s.kind)}
                    value={screenSummary(s.kind, form)}
                    missing={!screenFilled(s.kind, form)}
                    onEdit={() => goTo(s.id)}
                  />
                ))}
                {hidden.length > 0 && (
                  <div>
                    <div className="flex items-baseline gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 text-sm text-neutral-500">
                        {hidden.length} optional section{hidden.length === 1 ? "" : "s"} not added. You can add these later.
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [p.n]: !e[p.n] }))}
                        aria-expanded={isOpen}
                        className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                      >
                        {isOpen ? "Hide" : "Show"}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                        {hidden.map((s) => (
                          <button key={s.id} type="button" onClick={() => goTo(s.id)}
                            className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50">
                            <span className="w-40 shrink-0 text-xs font-medium text-neutral-500 sm:w-52">{screenLabel(s.kind)}</span>
                            <span className="min-w-0 flex-1 truncate text-sm italic text-neutral-300">Not added</span>
                            <span className="shrink-0 text-xs font-medium text-brand-700">Edit</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- the flow ------------------------------------------------------------------

export function GuidedFlow({ form, set, screenId, goTo, toggleArchetype, onSubmit, submitting, issues, onOpenSource }: Props) {
  // The flow walks FLOW_STEPS (core screens + the grouped optional step), not
  // the raw screen list. A ?screen= pointing at an optional question resolves
  // to the menu with that question's group already open.
  const idx = stepIndexForScreen(screenId);
  const step = FLOW_STEPS[idx];
  const openGroup = enrichmentTarget(screenId);
  const screen = step.kind === "screen" ? step.screen : null;
  const screenIssue = !!screen && issues.some((i) => i.screenId === screen.id);

  const goNext = () => { if (idx < FLOW_STEPS.length - 1) goTo(FLOW_STEPS[idx + 1].id); };
  const goBack = () => { if (idx > 0) goTo(FLOW_STEPS[idx - 1].id); };
  const isReview = screen?.kind === "review";
  const forwardLabel = idx === FLOW_STEPS.length - 2 ? "Review case →" : "Next →";

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
            <h2 className="font-serif text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">Add more detail</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-neutral-500">
              Optional. Skip this if you're short on time; you or another physician can add it later.
            </p>
            <div className="mt-6">
              <OptionalMenu
                groups={step.groups}
                form={form}
                set={set}
                toggleArchetype={toggleArchetype}
                openKey={openGroup?.key ?? null}
              />
            </div>
          </>
        ) : (
          <>
            {screen!.lead && <p className="mb-3 max-w-prose text-sm leading-relaxed text-neutral-600">{screen!.lead}</p>}
            {/* One type-size step smaller on a phone: at 2xl a two-line
                question pushed the input itself below the fold. */}
            <h2 className="font-serif text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">{screen!.question}</h2>
            {screen!.help && <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-neutral-500">{screen!.help}</p>}

            <div className="mt-6">
              {isReview ? (
                <ReviewScreen form={form} goTo={goTo} issues={issues} />
              ) : (
                <ScreenBody
                  screen={screen!}
                  form={form}
                  set={set}
                  toggleArchetype={toggleArchetype}
                  onEnter={goNext}
                  showSafetyPrompt={screen!.kind === "safety_harm" && screenIssue}
                  showProvenancePrompt={screen!.kind === "provenance" && screenIssue}
                />
              )}
            </div>
          </>
        )}

        {/* One navigation row: Back on the left, the single forward action on
            the right. Optional questions are skipped by pressing Next. On a
            phone this row gives way to the fixed bottom bar below, so the
            primary action is always in reach without scrolling. */}
        <div className="mt-8 hidden items-center justify-between gap-3 border-t border-neutral-100 pt-5 lg:flex">
          <button type="button" onClick={goBack} disabled={idx === 0} className="cg-btn-ghost -ml-2" aria-label="Previous question">
            ← Back
          </button>
          {!isReview ? (
            <button type="button" onClick={goNext} className="cg-btn-primary px-6" aria-label="Next question">
              {forwardLabel}
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={submitting} className="cg-btn-primary px-6">
              {submitting ? "Submitting…" : "Submit case"}
            </button>
          )}
        </div>
      </div>

      {/* Phone navigation. Replaces the floating "Source" and "↑ Top" buttons,
          which sat on top of whatever the author was trying to press. The
          primary action lives here, so nothing can overlay it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-neutral-200 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <button type="button" onClick={goBack} disabled={idx === 0} className="cg-btn-ghost px-3 disabled:opacity-40" aria-label="Previous question">
          ← Back
        </button>
        {!isReview ? (
          <button type="button" onClick={goNext} className="cg-btn-primary flex-1" aria-label="Next question">
            {forwardLabel}
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={submitting} className="cg-btn-primary flex-1">
            {submitting ? "Submitting…" : "Submit"}
          </button>
        )}
        <button type="button" onClick={onOpenSource} aria-label="Open the NSTG source panel"
          className="cg-btn-secondary flex h-9 w-10 items-center justify-center px-0">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9v14H4.5A1.5 1.5 0 0 1 3 15.5v-11Z" />
            <path d="M17 4.5A1.5 1.5 0 0 0 15.5 3H11v14h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
