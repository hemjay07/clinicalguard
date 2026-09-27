// The flow's navigation contract. Screen ids are stable because drafts,
// feedback notes and analytics key on them, while the numbers an author sees
// are derived from position — so these two things have to be tested against
// each other, or a reordering silently breaks resume links for in-progress
// cases.

import { describe, it, expect } from "vitest";
import {
  FLOW_STEPS,
  PHASES,
  SCREENS,
  displayNumber,
  emptyOptional,
  enrichmentTarget,
  isValidFlowParam,
  phaseSteps,
  screenById,
  screenFilled,
  screenSummary,
  stepIndexForScreen,
} from "./flow";
import { EMPTY } from "./caseForm";
import type { FormState } from "./caseForm";
import { ARCHETYPES } from "./guidance";

const form = (patch: Partial<FormState> = {}): FormState => ({ ...EMPTY, ...patch });

describe("displayed step numbers", () => {
  it("reads 1 2 / 1 2 3 4 5 + / 1 2 with no gaps", () => {
    const shown = PHASES.map((p) => phaseSteps(p.n).map(displayNumber).join(" "));
    expect(shown).toEqual(["1 2", "1 2 3 4 5 +", "1 2"]);
  });

  it("numbers by position even though the underlying ids are out of order", () => {
    // Provenance kept id 1.5 when it moved into phase 2; it must still show 5.
    const provenance = phaseSteps(2).find((s) => s.kind === "screen" && s.screen.kind === "provenance")!;
    expect(provenance.id).toBe("1.5");
    expect(displayNumber(provenance)).toBe("5");
  });
});

describe("resuming a case", () => {
  it("resolves every screen id, so an old draft link still opens", () => {
    for (const s of SCREENS) {
      expect(isValidFlowParam(s.id), `screen ${s.id}`).toBe(true);
      expect(stepIndexForScreen(s.id)).toBeGreaterThanOrEqual(0);
    }
  });

  it("sends an optional question to the grouped step, with its group opened", () => {
    const target = enrichmentTarget("2.5"); // expected investigations
    expect(target?.key).toBe("expected");
    expect(FLOW_STEPS[stepIndexForScreen("2.5")].kind).toBe("enrichment");
  });

  it("falls back to the first step for an unknown id rather than throwing", () => {
    expect(stepIndexForScreen("9.9")).toBe(0);
    expect(isValidFlowParam("9.9")).toBe(false);
  });

  it("keeps every screen reachable from some step", () => {
    for (const s of SCREENS) expect(screenById(s.id)).toBeTruthy();
  });
});

describe("what counts as answered", () => {
  it("counts provenance answered only when the submit gate would let it through", () => {
    // Filled must mean the same thing submit means, or a dot reads "done" on a
    // case submit will bounce.
    expect(screenFilled("provenance", form())).toBe(false);
    // A tier that needs no notes is answered on the tier alone.
    expect(screenFilled("provenance", form({ guideline_provenance: "nstg_only" }))).toBe(true);
    // A tier that claims an outside source is not answered until the notes exist.
    expect(screenFilled("provenance", form({ guideline_provenance: "nstg_plus_other" }))).toBe(false);
    expect(
      screenFilled("provenance", form({ guideline_provenance: "nstg_plus_other", provenance_notes: "WHO guidance." }))
    ).toBe(true);
  });

  it("counts a declared-empty safety answer as answered", () => {
    expect(screenFilled("safety_harm", form({ safety_none_declared: true }))).toBe(true);
    expect(screenFilled("safety_harm", form())).toBe(false);
  });

  it("counts monitoring when either tier has content", () => {
    expect(screenFilled("monitoring", form({ mon_expected: "Temperature" }))).toBe(true);
  });
});

describe("review summaries", () => {
  it("shows the plain sentence for a reasoning pattern, never the framework's name", () => {
    const value = ARCHETYPES[0].value;
    const summary = screenSummary("archetypes", form({ archetypes: [value] }));
    expect(summary).toBe(ARCHETYPES[0].plain);
    expect(summary).not.toContain(ARCHETYPES[0].label);
  });

  it("pairs the provenance tier with its notes", () => {
    const s = screenSummary(
      "provenance",
      form({ guideline_provenance: "nstg_plus_other", provenance_notes: "WHO TB-HIV guidance." })
    );
    expect(s).toContain("Mostly NSTG");
    expect(s).toContain("WHO TB-HIV guidance.");
  });
});

describe("optional sections", () => {
  it("counts only unanswered optional screens", () => {
    const before = emptyOptional(form()).length;
    const after = emptyOptional(form({ complications: "Cerebral malaria" })).length;
    expect(after).toBe(before - 1);
  });

  it("never counts a required screen as an optional one", () => {
    expect(emptyOptional(form()).every((s) => s.optional)).toBe(true);
  });
});
