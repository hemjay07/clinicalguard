# ADR-032: Decomposition rating task lives in the app

**Status:** Accepted (2026-08-02)

## Context

The rubric-decomposition rating task (15 frozen items; keep-whole vs split,
plus a one-line reason) existed only as a static HTML sheet with nowhere to
submit — the likely cause of weeks of non-response. It needs a real
submission path, and it must inherit the same identity and privacy
guarantees as case authoring (ADR-031).

## Decision

- **The 15 items are seed content in code** (`clinicalguard/decomposition_items.py`),
  mirroring the task sheet: grouped by source case with its clinical query,
  task-sheet numbering 1–15. Identical for every rater, never authored
  through the UI — that invariance is the measurement.
- **`decomposition_response`** (Alembic-migrated): one row per rater × item —
  `rater_user_id` FK, `item_id`, `decision` (`keep_whole`/`split`),
  `split_count` (only for splits), required `reason`, timestamps, unique on
  (rater, item). Editing revises the row in place, and the flow tells raters
  explicitly they may revise earlier answers (a rater who changes their mind
  mid-task must not feel forced to stay consistent).
- **The decomposition rulebook is never rater-facing.** The intro teaches
  only the trivial split/keep mechanic (X-ray + FBC example); the three
  rulebook patterns appear nowhere a rater can see, exactly as the HTML
  sheet withheld them — the measurement dies if raters see the rules.
- **Results privacy:** a rater reads/edits only their own responses. The
  aggregate (rater × item × decision × split_count × reason) is an
  owner-only export (CSV/JSON). No agreement stats, kappa, or charts in-app;
  that analysis happens deliberately, offline, from the raw export.
- Access is a link plus Google sign-in (`/decompose`) — no invitation or
  email machinery.

## Consequences

- Changing the item set is a code change with a version bump
  (`TASK_VERSION`), not a data edit — deliberate, reviewable, and frozen
  between raters.
- The old HTML sheet is retired as the submission vehicle; anything already
  returned through it is transcribed by hand via the same endpoints if
  needed.
