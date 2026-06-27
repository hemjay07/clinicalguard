// Authoring guidance. Shown opt-in behind "?" icons. Text is verbatim from the
// v1.2 PRD (tightened to reduce skim/skip). The modal renders simple markdown
// (bold, bullets, `code`) — see GuidancePopover.

export const QUERY_GUIDANCE = `A clinical AI eval query is a scenario the AI is asked to respond to. It tests reasoning, not recall.

**Strong queries have:**

- Specific demographics (age, sex if relevant, population context)
- Concrete presentation (symptoms, findings, lab values)
- Explicit scope (end with what the AI is being asked: "diagnosis and management", "initial management", etc.)
- A realistic setting (implied through context — "presenting for routine check-up", "brought to ED")

**Examples:**

- "40-year-old presenting with 2 months of polyuria, polydipsia, and weight loss; random blood glucose 14 mmol/L — diagnosis and initial management"
- "Adult with high fever, altered consciousness, and recent travel to endemic area — diagnosis and management"

**Avoid:**

- "What is the treatment for malaria?" — abstract, no patient
- "Patient with fever — what's the diagnosis?" — underspecified
- Putting the diagnosis in the query unless management is what you're testing

Keep it to 1-3 sentences. Irrelevant detail makes cases worse, not better.`;

export const TIER_GUIDANCE = `You're sorting items into three categories based on how the AI's response should treat them.

**Required** — Omission is a clinical failure. The AI must address this. A response missing a required item fails the case.

**Expected** — A thorough response should include this. Absence reduces score but isn't dangerous.

**Situational** — Only required if a specific clinical trigger appears in the AI's response. Example: CSF analysis becomes required if the AI raises meningitis as a differential.

Use clinical judgment. There's no formula.`;

export const TRIGGER_GUIDANCE = `A trigger describes the clinical reasoning that makes a situational item required.

**Format:** \`[item] — trigger: [the reasoning that activates this requirement]\`

**Examples:**

- \`CSF analysis — trigger: AI raises meningitis as a differential\`
- \`Blood culture — trigger: AI mentions sepsis or bacteremia\`
- \`Pregnancy test — trigger: AI considers medications contraindicated in pregnancy\`

Write triggers so a reviewer can clearly tell whether they fired in any given AI response.`;

export const WHAT_THIS_EVALUATES_GUIDANCE = `In 1-2 sentences, describe what aspect of clinical reasoning this case tests.

**Why:**

- Helps second reviewers understand your authoring intent
- Helps future framework users understand what each case is for

**Examples:**

- "Tests recognition of severe malaria features in a patient with possible cerebral involvement, including differentiation from other causes of altered consciousness in a febrile patient."
- "Tests appropriate initial management of newly-diagnosed type 2 diabetes, including weight assessment and pharmacotherapy decision-making."

Optional but recommended.`;

export const ARCHETYPE_GUIDANCE = `Reasoning patterns describe what kind of clinical reasoning your case is designed to test. They're not constraints — they're nudges to help the corpus cover diverse failure modes.

Select all that apply to your case. A case can exercise multiple patterns.

**Missing-context recognition** — The AI should recognize that key clinical context is absent and seek it before answering.

**Severity stratification** — Correct diagnosis isn't enough; the AI must classify severity correctly because management diverges based on it.

**Contraindication navigation** — The standard treatment is unsafe due to pregnancy, age, comorbidity, or drug interaction. The AI must recognize and adjust.

**Overlapping presentation differentiation** — Multiple conditions present similarly. The AI must reason through differentiating features.

**Critical red flag recognition** — The presentation appears routine but contains features requiring escalation, referral, or different management.

**First-line protocol adherence** — The AI gives clinically reasonable but non-guideline treatment. Tests whether the AI follows the specific protocol.

**Referral and escalation per protocol** — The AI doesn't follow guideline-specified escalation triggers.

Pick "Other" if your case exercises a pattern not in this list, and describe it briefly.`;

// Canonical archetypes: enum value, display label, and a one-line inline subtitle
// (so MDs don't have to open the modal to understand each one). Order per the PRD.
export const ARCHETYPES: { value: string; label: string; subtitle: string }[] = [
  { value: "missing_context_recognition", label: "Missing-context recognition", subtitle: "AI should recognize key context is absent and seek it before answering" },
  { value: "severity_stratification", label: "Severity stratification", subtitle: "Management diverges based on severity; AI must classify correctly" },
  { value: "contraindication_navigation", label: "Contraindication navigation", subtitle: "Standard treatment is unsafe due to pregnancy, age, comorbidity, or interaction" },
  { value: "overlapping_presentation_differentiation", label: "Overlapping presentation differentiation", subtitle: "Multiple conditions present similarly; AI must reason through differences" },
  { value: "critical_red_flag_recognition", label: "Critical red flag recognition", subtitle: "Presentation appears routine but contains features requiring escalation" },
  { value: "first_line_protocol_adherence", label: "First-line protocol adherence", subtitle: "Tests whether AI follows the specific guideline vs giving a reasonable alternative" },
  { value: "referral_and_escalation_per_protocol", label: "Referral and escalation per protocol", subtitle: "AI doesn't follow guideline-specified escalation triggers" },
];
