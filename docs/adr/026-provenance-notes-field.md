# ADR-026: Provenance notes field for graduated-provenance transparency

**Status:** Accepted (2026-07-02)

## Context

Cases can mix sources: guideline-grounded content (NSTG), other named
guidelines (e.g. ADA 2024 for DKA, which NSTG does not cover), and the
author's clinical judgment. The case record had no place to say which parts
came from where, weakening reviewability of mixed-source cases.

## Decision

Add a free-text `provenance_notes` field to the authoring payload and store it
in the `eval_cases.expected_response` JSON blob (no schema migration — the blob
is the case body's storage). Surfaced as:

- Guided flow screen 1.6 ("What is the provenance of this case's ground
  truth?") and a "Ground truth provenance" field in the full form.
- Displayed on the case detail page when present.

Optional; empty string when unused.

## Consequences

- Mixed-source cases carry their own audit trail; reviewers can distinguish
  guideline-grounded claims from judgment-authored ones.
- No migration needed; older cases simply lack the key.
