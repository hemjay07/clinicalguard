# ADR-023: Sectioned Authoring-Form Layout

**Date:** 2026-06-15
**Status:** Accepted

## Context
The authoring form presented 20+ input fields on a single scroll. Even with clear
labels and groupings, a first-time author had to scan a wall of fields before
knowing where to start. The save-state indicator sat at the bottom, below the fold,
so authors could not see save status while working.

## Decision
Reorganize the form into **three collapsible sections** that map to the natural
authoring flow:

1. **Frame the case** — author, reasoning patterns, query, what-it-evaluates, scope.
2. **Author the expected response** — diagnoses, investigations, treatments,
   complications, monitoring & escalation.
3. **Safety layer** — applicable safety rules and free-text flags.

Each section is a card with a number, a one-line subtitle, a chevron toggle, and a
status badge (Not started / In progress / Filled) that is a *visual hint, not
validation* — a partially filled case can still be submitted. All sections are
expanded by default (nothing hidden); the MD can collapse completed sections to
reduce load, and collapse state persists in `sessionStorage` for the session.

The save-state indicator moves into a **sticky header bar** (title left, save state
right) that stays visible while scrolling. The Save-as-draft and Submit buttons
stay at the bottom. A floating "back to top" affordance appears once the author
scrolls past the first section. Field density is tightened (~20% less scroll depth)
without cramping. The case JSON schema is unchanged, so v1.2 drafts load unchanged.

## Consequences
Structure is legible at a glance (three cards) rather than as a field wall, and
save state is always visible. Nothing is hidden, so the change is presentation-only
and carries no validation or data risk. The status badges are deliberately
non-binding to avoid implying a completeness gate the framework does not enforce.
