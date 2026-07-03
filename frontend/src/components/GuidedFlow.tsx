// The guided authoring flow (default view): the case as a journey through the
// three phases, one clinical question per screen. Navigation is free — phase
// names, breadcrumb dots, and arrows all jump anywhere; answers persist via
// the shared FormState + autosave in the Authoring shell.

import { useState } from "react";
import type { FormState, RuleInfo, ValidationIssue } from "../caseForm";
import type { EvalCasePayload } from "../types";
import { PHASES, SCREENS, screenIndex, phaseScreens, screenFilled, screenSummary, previewFragment } from "../flow";
import type { ScreenDef } from "../flow";
import { ArchetypePicker, SafetyRuleList, TextModal, ExampleToggle } from "./fields";
import { GuidanceIcon } from "./GuidancePopover";
import { QUERY_GUIDANCE, TRIGGER_GUIDANCE, WHAT_THIS_EVALUATES_GUIDANCE, ARCHETYPE_GUIDANCE, PROVENANCE_GUIDANCE, SAFETY_EXPLAINER_CARD, SAFETY_LEARN_MORE, QUERY_EXAMPLE } from "../guidance";

interface Props {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  payload: EvalCasePayload;
  screenId: string;
  goTo: (id: string) => void;
  safetyRules: RuleInfo[];
  toggleRule: (id: number) => void;
  toggleArchetype: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  issues: ValidationIssue[];
}

// --- phase bar ---------------------------------------------------------------

function PhaseBar({ current, goTo, form }: { current: ScreenDef; goTo: (id: string) => void; form: FormState }) {
  return (
    <div className="px-1">
      <div className="grid grid-cols-3 gap-2">
        {PHASES.map((p) => {
          const screens = phaseScreens(p.n);
          const isCurrent = p.n === current.phase;
          const isPast = p.n < current.phase;
          // Position within the phase (progress line shows position, not completion).
          const posInPhase = isCurrent ? screens.findIndex((s) => s.id === current.id) + 1 : 0;
          const frac = isPast ? 1 : isCurrent ? posInPhase / screens.length : 0;
          return (
            <button key={p.n} type="button" onClick={() => goTo(screens[0].id)} className="group min-w-0 rounded-lg px-1 py-1 text-left transition-colors hover:bg-neutral-50">
              <span className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-serif text-[11px] font-semibold transition-colors ${
                  isCurrent ? "bg-brand-700 text-white" : isPast ? "bg-brand-100 text-brand-700" : "bg-neutral-100 text-neutral-400"
                }`}>
                  {isPast ? "✓" : p.n}
                </span>
                <span className={`truncate text-xs font-medium sm:text-sm ${isCurrent ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-600"}`}>
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

      {/* Breadcrumb dots for the current phase — clickable, show fill state. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {phaseScreens(current.phase).map((s) => {
          const active = s.id === current.id;
          const filled = screenFilled(s.kind, form);
          return (
            <button
              key={s.id}
              type="button"
              title={`${s.id} — ${s.crumb}`}
              onClick={() => goTo(s.id)}
              className={`h-6 min-w-6 rounded-full px-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-brand-700 text-white"
                  : filled
                    ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100"
                    : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
              }`}
            >
              {s.id.split(".")[1]}
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

function ScreenBody({ screen, form, set, safetyRules, toggleRule, toggleArchetype, onEnter }: {
  screen: ScreenDef;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  safetyRules: RuleInfo[];
  toggleRule: (id: number) => void;
  toggleArchetype: (value: string) => void;
  onEnter: () => void;
}) {
  const [learnMore, setLearnMore] = useState(false);
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
    case "author":
      return <input {...inputProps("authored_by", "Your name")} autoFocus />;
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
          <ExampleToggle text={QUERY_EXAMPLE} />
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
          <textarea {...textareaProps("provenance_notes", 3, '"General diabetes management from NSTG. DKA protocol from ADA 2024, as NSTG does not cover DKA specifically."')} />
          <div className="mt-2"><GuidanceIcon title="Ground truth provenance" text={PROVENANCE_GUIDANCE} /> <span className="text-xs text-neutral-400">Why provenance matters</span></div>
        </div>
      );
    case "primary":
      return <input {...inputProps("primary", "The diagnosis the AI should reach (kept out of the query).")} autoFocus />;
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="cg-label">Required</div>
            <textarea {...textareaProps("esc_required", 4, "One per line — e.g. Blood glucose not falling despite adequate therapy")} />
          </div>
          <div>
            <div className="cg-label">Expected</div>
            <textarea {...textareaProps("esc_expected", 4, "One per line — e.g. Persistent vomiting compromising airway safety")} />
          </div>
        </div>
      );
    case "safety_rules":
      return (
        <div>
          <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-sm font-medium text-brand-800">Safety rules score separately from the clinical rubric.</p>
            <p className="mt-1 text-sm leading-relaxed text-brand-800/80">{SAFETY_EXPLAINER_CARD}</p>
            <button type="button" onClick={() => setLearnMore(true)} className="mt-2 text-xs font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700">
              Learn more about safety rules
            </button>
          </div>
          <SafetyRuleList rules={safetyRules} selectedIds={form.selected_rule_ids} toggleRule={toggleRule} />
          {learnMore && <TextModal title="How safety rules work" text={SAFETY_LEARN_MORE} onClose={() => setLearnMore(false)} />}
        </div>
      );
    case "safety_flags":
      return <textarea {...textareaProps("safety_free_text", 3, "One per line — e.g. Insulin should not be initiated without first confirming serum potassium above 3.3 mmol/L…")} />;
    case "review":
      return null; // rendered by ReviewScreen
  }
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

export function GuidedFlow({ form, set, payload, screenId, goTo, safetyRules, toggleRule, toggleArchetype, onSubmit, submitting, issues }: Props) {
  const idx = screenIndex(screenId);
  const screen = SCREENS[idx];
  const inPhase = phaseScreens(screen.phase);
  const posInPhase = inPhase.findIndex((s) => s.id === screen.id) + 1;
  const phaseTitle = PHASES.find((p) => p.n === screen.phase)!.title;

  // "How this fits into the case" open-state persists for the session so the
  // MD opts in once, not on every screen.
  const [showFit, setShowFit] = useState(() => sessionStorage.getItem("cg_show_fit") === "1");
  const toggleFit = () => setShowFit((v) => { sessionStorage.setItem("cg_show_fit", v ? "0" : "1"); return !v; });

  const goNext = () => { if (idx < SCREENS.length - 1) goTo(SCREENS[idx + 1].id); };
  const goBack = () => { if (idx > 0) goTo(SCREENS[idx - 1].id); };
  const fragment = previewFragment(screen.kind, payload);
  const isReview = screen.kind === "review";

  return (
    <div className="space-y-5">
      <PhaseBar current={screen} goTo={goTo} form={form} />

      {/* key= remounts on navigation so the enter animation replays and
          per-screen local state (example toggles, learn-more) resets. */}
      <div key={screen.id} className="cg-screen-enter cg-card px-5 py-7 sm:px-10 sm:py-9">
        <p className="cg-eyebrow">Phase {screen.phase} · {phaseTitle} — question {posInPhase} of {inPhase.length}</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug text-neutral-900">{screen.question}</h2>
        {screen.help && <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-neutral-500">{screen.help}</p>}

        <div className="mt-6">
          {isReview ? (
            <ReviewScreen form={form} goTo={goTo} issues={issues} />
          ) : (
            <ScreenBody screen={screen} form={form} set={set} safetyRules={safetyRules} toggleRule={toggleRule} toggleArchetype={toggleArchetype} onEnter={goNext} />
          )}
        </div>

        {!isReview && fragment && (
          <div className="mt-6">
            <button type="button" onClick={toggleFit} className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600">
              {showFit ? "▾" : "▸"} How this fits into the case
            </button>
            {showFit && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-600">
                {JSON.stringify(fragment, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* One navigation row: Back on the left, the single forward action on
            the right. Optional questions are skipped by pressing Next. */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
          <button type="button" onClick={goBack} disabled={idx === 0} className="cg-btn-ghost -ml-2" aria-label="Previous question">
            ← Back
          </button>
          {!isReview ? (
            <button type="button" onClick={goNext} className="cg-btn-primary px-6" aria-label="Next question">
              {idx === SCREENS.length - 2 ? "Review case →" : "Next →"}
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
