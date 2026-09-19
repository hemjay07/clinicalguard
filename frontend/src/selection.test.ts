// The selected conditions travel two ways: through the authoring URL (encode /
// decode) so a refresh keeps the selection, and as a draft key (draftSlug /
// refsFromSlug) that the one-time server-draft migration reads back. A round
// trip that drops a subtype or reorders the set silently sends an author to the
// wrong draft, so both pairs are tested against their own inverse.

import { describe, it, expect } from "vitest";
import {
  encodeConditions,
  decodeConditions,
  draftSlug,
  refsFromSlug,
} from "./selection";
import type { ConditionRef } from "./types";

const ref = (condition_id: number, subtype: string | null = null): ConditionRef => ({
  condition_id,
  subtype,
});

describe("encode / decode conditions (URL param)", () => {
  it("round-trips ids and subtypes, including null", () => {
    const refs = [ref(12, "type-1"), ref(7, null)];
    expect(decodeConditions(encodeConditions(refs))).toEqual(refs);
  });

  it("normalizes a missing subtype to null on encode", () => {
    const encoded = encodeConditions([{ condition_id: 5 } as ConditionRef]);
    expect(decodeConditions(encoded)).toEqual([ref(5, null)]);
  });

  it("treats null and empty string params as no selection", () => {
    expect(decodeConditions(null)).toEqual([]);
    expect(decodeConditions("")).toEqual([]);
  });

  it("returns empty on a malformed param instead of throwing", () => {
    expect(decodeConditions("not-json")).toEqual([]);
    expect(decodeConditions("%")).toEqual([]);
  });

  it("returns empty when the payload is not an array", () => {
    expect(decodeConditions(encodeURIComponent(JSON.stringify({ condition_id: 3 })))).toEqual([]);
  });

  it("drops entries without a numeric condition_id", () => {
    const raw = encodeURIComponent(
      JSON.stringify([{ condition_id: 4, subtype: null }, { subtype: "x" }, { condition_id: "9" }]),
    );
    expect(decodeConditions(raw)).toEqual([ref(4, null)]);
  });
});

describe("draftSlug (autosave key)", () => {
  it("is order-independent", () => {
    expect(draftSlug([ref(3, "a"), ref(1, null)])).toBe(draftSlug([ref(1, null), ref(3, "a")]));
  });

  it("renders a null subtype as an empty segment", () => {
    expect(draftSlug([ref(8, null)])).toBe("8:");
  });
});

describe("refsFromSlug (legacy draft read-back)", () => {
  it("inverts draftSlug for a set of refs", () => {
    const refs = [ref(1, null), ref(3, "a")];
    const back = refsFromSlug(draftSlug(refs));
    expect([...back].sort((x, y) => x.condition_id - y.condition_id)).toEqual(refs);
  });

  it("maps an empty subtype back to null", () => {
    expect(refsFromSlug("8:")).toEqual([ref(8, null)]);
  });

  it("returns empty for an empty slug", () => {
    expect(refsFromSlug("")).toEqual([]);
  });
});
