// The gate between a physician and a submitted case.
//
// Every test here stands for a way the app has actually blocked, or could
// silently block, someone who had done the work. The safety tests exist
// because a physician listed two real constraints, ticked "nothing rises to
// that level" as well, and was told to "either list the dangers, or confirm
// there are none" — the thing they had just done. Nothing in the frontend
// caught that, because until now the frontend had no tests at all.

import { describe, it, expect } from "vitest";
import {
  EMPTY,
  isBlank,
  lines,
  mergeDraft,
  normaliseSafety,
  parseSituational,
  provenanceAnswered,
  requiredIssues,
  safetyAnswered,
  safetyConflict,
  safetyPromptFor,
  toPayload,
  SAFETY_PROMPT,
  SAFETY_CONFLICT_PROMPT,
  SAFETY_SCREEN_ID,
  PROVENANCE_SCREEN_ID,
} from "./caseForm";
import type { FormState } from "./caseForm";

const form = (patch: Partial<FormState> = {}): FormState => ({ ...EMPTY, ...patch });

const TWO_CONSTRAINTS =
  "1.Ensure to complete Antimalarial regimens when diagnosis is confirmed\n2. Rapid diagnosis test is necessary to confirm diagnosis";

describe("the safety question", () => {
  it("accepts listed constraints", () => {
    expect(safetyAnswered(form({ safety_harm_text: TWO_CONSTRAINTS }))).toBe(true);
  });

  it("accepts an explicit declaration that there are none", () => {
    expect(safetyAnswered(form({ safety_none_declared: true }))).toBe(true);
  });

  it("rejects an unanswered question", () => {
    expect(safetyAnswered(form())).toBe(false);
  });

  it("rejects constraints AND a declaration of none, which is contradictory", () => {
    const f = form({ safety_harm_text: TWO_CONSTRAINTS, safety_none_declared: true });
    expect(safetyAnswered(f)).toBe(false);
    expect(safetyConflict(f)).toBe(true);
  });

  // The bug was never the rule; it was that both failures said the same thing.
  it("names the tick when that is what is blocking, not 'list the dangers'", () => {
    const stuck = form({ safety_harm_text: TWO_CONSTRAINTS, safety_none_declared: true });
    expect(safetyPromptFor(stuck)).toBe(SAFETY_CONFLICT_PROMPT);
    expect(safetyPromptFor(stuck).toLowerCase()).toContain("untick");
    expect(safetyPromptFor(form())).toBe(SAFETY_PROMPT);
  });

  it("opens a draft saved in the contradictory state so its author can submit", () => {
    const stuck = form({ safety_harm_text: TWO_CONSTRAINTS, safety_none_declared: true });
    const fixed = normaliseSafety(stuck);
    expect(safetyAnswered(fixed)).toBe(true);
    // Their words survive; only the tick is dropped.
    expect(fixed.safety_harm_text).toBe(TWO_CONSTRAINTS);
    expect(fixed.safety_none_declared).toBe(false);
  });

  it("leaves a valid form alone", () => {
    const declared = form({ safety_none_declared: true });
    expect(normaliseSafety(declared)).toEqual(declared);
  });

  it("treats whitespace-only text as no constraints", () => {
    expect(safetyAnswered(form({ safety_harm_text: "   \n  \n" }))).toBe(false);
    expect(safetyAnswered(form({ safety_harm_text: "  \n ", safety_none_declared: true }))).toBe(true);
  });
});

describe("the provenance question", () => {
  it("requires a tier", () => {
    expect(provenanceAnswered(form())).toBe(false);
  });

  it("accepts nstg_only with no notes, because there is nothing to attribute", () => {
    expect(provenanceAnswered(form({ guideline_provenance: "nstg_only" }))).toBe(true);
  });

  it.each(["nstg_plus_other", "judgment_primary"])(
    "requires notes for %s, which claims something came from outside NSTG",
    (tier) => {
      expect(provenanceAnswered(form({ guideline_provenance: tier }))).toBe(false);
      expect(provenanceAnswered(form({ guideline_provenance: tier, provenance_notes: "  " }))).toBe(false);
      expect(
        provenanceAnswered(form({ guideline_provenance: tier, provenance_notes: "WHO TB-HIV guidance." }))
      ).toBe(true);
    }
  );
});

describe("the submit gate (requiredIssues)", () => {
  const messages = (f: FormState) => requiredIssues(f).map((i) => i.message);
  const screens = (f: FormState) => requiredIssues(f).map((i) => i.screenId);

  // A resolved case: an answered safety question and a tier that needs no notes.
  const ok = form({ safety_none_declared: true, guideline_provenance: "nstg_only" });

  it("lets a fully-answered case through with no issues", () => {
    expect(requiredIssues(ok)).toEqual([]);
  });

  it("reports both unmet answers at once, not one per submit", () => {
    // The whack-a-mole the old one-at-a-time gate caused: fix safety, resubmit,
    // then discover provenance. Both come back together now.
    expect(screens(form())).toEqual([SAFETY_SCREEN_ID, PROVENANCE_SCREEN_ID]);
  });

  it("blocks a tier that looks picked but still needs notes", () => {
    // The exact 'I filled it and it still would not submit' case: the tier is
    // chosen, so the screen read as done, but the notes it demands are missing.
    const f = form({ safety_none_declared: true, guideline_provenance: "nstg_plus_other" });
    expect(screens(f)).toEqual([PROVENANCE_SCREEN_ID]);
  });

  it("clears once the missing notes are supplied", () => {
    const f = form({
      safety_none_declared: true,
      guideline_provenance: "nstg_plus_other",
      provenance_notes: "WHO guidance.",
    });
    expect(requiredIssues(f)).toEqual([]);
  });

  it("surfaces the safety conflict message, not the generic prompt", () => {
    const f = form({ safety_harm_text: TWO_CONSTRAINTS, safety_none_declared: true, guideline_provenance: "nstg_only" });
    expect(messages(f)).toEqual([SAFETY_CONFLICT_PROMPT]);
  });
});

describe("drafts", () => {
  it("treats an untouched form as blank, so opening a condition saves nothing", () => {
    expect(isBlank(EMPTY)).toBe(true);
    expect(isBlank(form({ safety_none_declared: true }))).toBe(false);
    expect(isBlank(form({ archetypes: ["red_flag"] }))).toBe(false);
    expect(isBlank(form({ query: "   " }))).toBe(true);
  });

  // A slow draft fetch used to land after the author had started typing and
  // overwrite them. Neither side may lose work.
  it("keeps typing on top of a draft that arrives late, field by field", () => {
    const fetched = form({ query: "Fetched scenario", primary: "Malaria" });
    const typed = form({ primary: "Incomplete abortion" });
    const merged = mergeDraft(fetched, typed);
    expect(merged.primary).toBe("Incomplete abortion"); // what they typed wins
    expect(merged.query).toBe("Fetched scenario"); // and nothing else is lost
  });

  it("does not let an empty typed field blank out a saved answer", () => {
    const merged = mergeDraft(form({ query: "Saved scenario" }), form({ query: "" }));
    expect(merged.query).toBe("Saved scenario");
  });
});

describe("situational triggers", () => {
  // The em dash here is a parsed token, not prose. If a copy sweep ever
  // changes the format the flow tells authors to use, triggers silently
  // vanish from the corpus and nothing else notices.
  it("splits an item from its trigger on the documented separator", () => {
    const [item] = parseSituational("CSF analysis — trigger: AI raises meningitis");
    expect(item).toEqual({ item: "CSF analysis", trigger: "AI raises meningitis" });
  });

  it("keeps a line with no trigger rather than dropping it", () => {
    expect(parseSituational("Blood culture")).toEqual([{ item: "Blood culture", trigger: "" }]);
  });
});

describe("the submitted payload", () => {
  it("carries the safety answer, the provenance tier and the parsed triggers", () => {
    const f = form({
      query: " Adult with fever ",
      primary: " Malaria ",
      guideline_provenance: "nstg_plus_other",
      provenance_notes: " WHO guidance ",
      safety_harm_text: TWO_CONSTRAINTS,
      inv_situational: "CSF analysis — trigger: AI raises meningitis",
      critical_differentials: "Typhoid\n\n  Sepsis  ",
    });
    const p = toPayload(f, [{ condition_id: 1, subtype: null }]);

    expect(p.query).toBe("Adult with fever");
    expect(p.diagnoses.primary).toBe("Malaria");
    expect(p.guideline_provenance).toBe("nstg_plus_other");
    expect(p.provenance_notes).toBe("WHO guidance");
    expect(p.safety.free_text).toHaveLength(2);
    expect(p.safety.none_declared).toBe(false);
    expect(p.investigations.situational[0].trigger).toBe("AI raises meningitis");
    // Blank lines are dropped and entries trimmed, so the corpus stays clean.
    expect(p.diagnoses.critical_differentials).toEqual(["Typhoid", "Sepsis"]);
  });

  it("sends null rather than an empty string when no tier is chosen", () => {
    expect(toPayload(EMPTY, []).guideline_provenance).toBeNull();
  });
});

describe("lines", () => {
  it("drops blanks and trims, which is what every one-per-line field relies on", () => {
    expect(lines("  a \n\n  b  \n   \n")).toEqual(["a", "b"]);
    expect(lines("")).toEqual([]);
  });
});
