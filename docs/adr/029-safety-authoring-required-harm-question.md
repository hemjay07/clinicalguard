# ADR-029: Safety authoring as a required clinical harm question

**Status:** Accepted (2026-07-15)

## Context

The v1.3/v1.3.1 safety section presented as a two-step, fully optional flow:
pick from existing verified rules, then a separate screen to "author your own
instead." Both screens carried `optional: true` — nothing distinguished a
case where the author considered harm and found none from a case where the
section was simply skipped.

Two fluent physicians (Mujeeb, Quddus) authored cases through this flow.
Quddus produced zero safety flags on both of his, despite correct, disciplined
tiering everywhere else in those cases. The flow itself, not the author, was
the problem: presenting safety as optional makes skipping it a reasonable
default action, and a fluent author took it.

Safety is arguably the most important part of a case. It needed to be
redesigned as a required clinical judgment the author cannot avoid making —
without exposing the framework's internal machinery (rule verification,
severity, scoring) to do it.

## Decision

**One required question, in the author's own clinical words, placed last.**

- The two-step rule-selection/free-text flow is gone. In its place: a single
  screen asking *"What must the AI never do, or never leave out, because it
  would harm this patient?"*, with guidance to list only danger-level
  constraints, not general best-practice preferences.
- **Author-facing concept vs. architecture property, kept separate.** The
  author writes in plain clinical language — a danger-level constraint, not a
  "rule." The words "flag," "rule," "verified," "severity," and any score are
  never shown in this UI. What happens to that text internally (verified-rule
  auto-attachment by condition, candidate-rule collection, eventual scoring)
  is an implementation detail the author is never asked to understand or
  manage. Verified rules for the case's conditions still auto-attach via
  `get_relevant_rules()` — unchanged, just invisible to the author.
- **Required, with a valid-empty escape.** The author cannot submit without
  resolving the section, but "nothing rises to that level" is a legitimate,
  common answer (e.g. a straightforward hypertension case). Two mutually
  exclusive controls: free text listing constraints, or an explicit checkbox
  "No danger-level constraints apply to this patient." Submission is blocked
  unless exactly one is satisfied — both empty (skipped) and both filled
  (contradictory) are invalid states, enforced both client-side (quiet inline
  prompt, not a red error box) and server-side (422).
  This is the one deliberate exception to v1.3.1 §4's "nothing is required at
  submission" — every other field stays optional.
- **A declared empty is stored distinctly from an unanswered one.**
  `eval_cases.safety_none_declared` (boolean, default `False`) is `True` only
  when the checkbox was actively ticked. `False` covers both "not yet
  answered" (all pre-v1.4 rows) and "answered with constraints" — those two
  are distinguished by whether `required_safety_flags.free_text` is non-empty
  in the case blob. This matters for future analysis of how often authors
  declare genuine empties vs. how often the section goes unanswered.
- **Placement: last, immediately before submit.** The author needs the full
  clinical picture (diagnosis, treatments, monitoring) already authored to
  judge what would harm this patient. Its importance is signalled by being
  the final gate every case must clear, not by being moved artificially
  early.
- Free-text lines still flow into `candidate_safety_rules` on submit exactly
  as ADR-027 specified — this redesign changes the authoring UI and the
  required/valid-empty semantics, not the collection pipeline.

## Consequences

- A case authored through the new flow can no longer have a silently-empty
  safety section — every case either has constraints or an explicit
  declaration of none.
- The verified-rule selection UI (`SafetyRuleList`, the "Learn more about
  safety rules" modal, the CRITICAL/WARNING explainer copy) is removed from
  authoring entirely. Verified rules remain a real, queried construct
  server-side; they're simply no longer author-facing.
- Existing pre-v1.4 cases (including Quddus's two) have `safety_none_declared
  = False` and empty `required_safety_flags.free_text` — indistinguishable
  from "declared empty" by that field alone, but correctly resolvable via
  case editing (ADR-030): opening one in the editor shows the harm question
  in its genuinely unanswered state, forcing a real answer on re-save.
