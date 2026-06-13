# ADR-019: MD-Authoring UI for Evaluation Cases

**Date:** 2026-06-13
**Status:** Accepted

## Context
Phase 3 produces the methodology that ClinicalGuard's value rests on:
MD-authored evaluation cases derived from structured guideline data. An earlier
auto-generation framing was considered, in which an LLM would read the
structured NSTG data and *propose* tier assignments (required / expected /
situational), construct the clinical query, and filter the source material into
a candidate case. That framing was rejected: letting the model propose the case
anchors the physician to the model's choices and quietly converts "MD-authored
ground truth" into "MD-reviewed model output". A benchmark that is itself
model-shaped cannot credibly measure models.

A softer "research-assistant" variant was then considered — keep an LLM in the
loop purely to *annotate* the structured source material (purpose, source
language, notes) without proposing tiers or queries. On reflection this was also
removed. The NSTG data is already structured and clean; an annotation layer adds
LLM latency, cost, and non-determinism to the authoring path while providing
little the physician cannot read directly from the source. Keeping the authoring
path deterministic and model-free is the stronger position for a methodology
paper.

Two physicians in different locations (Nigeria and Atlanta) need to author the
first batch of cases collaboratively, which requires a deployed, shared-URL
tool. This ADR records the decision to build that tool (Phase A).

## Decision
**The MD authors the case by hand, directly from the raw structured NSTG data.
No LLM is involved in the authoring path.**

`generation/template_extractor.extract_skeleton(condition_id, subtype, db)` is
the deterministic data-access layer. It serializes the structured NSTG data for
a condition/subtype into a clean shape (findings grouped by subtype,
investigations, treatments by type, differentials, complications, safety
signals) with source-field traceability. The API endpoint
`GET /conditions/{id}/source-material` simply returns this. The frontend
SourcePanel renders the shape directly so the physician reviews the same source
the case is authored from.

A minimal authoring UI (FastAPI backend at `clinicalguard/api/`, React/Vite
frontend at `frontend/`) presents this source material beside an authoring form.
The form mirrors the structure of the three hand-written reference cases in
`retrieval/eval_cases/nstg_derived/` (required / expected / situational tiers,
expected diagnosis, monitoring, escalation, safety flags). Authoring guidance is
shown **opt-in** behind icons so the framework does not shape how an MD writes a
case.

**Provenance and scoring.** Cases created through the UI are stored with
`ground_truth_source = "md_authored_via_ui"`, distinct from the `"nstg_derived"`
value used by the three hand-seeded reference cases, so the two provenances stay
separable. Because both are genuine MD-authored ground truth in the same
structural shape, the scorer dispatcher (`retrieval/eval_scorer.py`) routes
**both** values through `score_response_against_expected`. The authored case
JSON lives in the existing `eval_cases.expected_response` column; no schema
migration is introduced, and UI-only metadata (`authored_by`,
`what_this_evaluates`, `subtype`, selected safety-rule ids) is carried inside
that JSON blob.

**Scope (Phase A).** No authentication — security through URL obscurity is
acceptable for two trusted authors. NSTG only. Read-only views (conditions
overview, safety-rules browser, submitted cases) make existing framework work
visible but add no new backend capability. Case execution, dashboards, review
queues, and the multi-contributor pipeline are out of scope (Phase D).

**Dropped: generatability classification.** An earlier idea to classify the 251
conditions as fully / partially / not "generatable" (a 46/56/149 split) was a
by-product of the auto-generation framing and is discarded. The conditions
overview simply browses the 251 conditions and the structured data counts that
exist for each.

## Consequences
The dataset stays genuinely MD-authored and the authoring path stays
deterministic — no model output enters the ground truth, directly or as
annotation. This is the defensible position for a methodology paper. The cost is
throughput (authoring is slower than reviewing generated cases), which is
acceptable for the 10–15 cases targeted in Phase B.

Removing the LLM also simplifies the backend: `GET /source-material` is a fast
database read with no latency to amortize, so no caching layer is needed.

Storing authored cases as a JSON blob in `expected_response` avoids a migration
and keeps the UI decoupled from the relational schema, at the cost of those
fields not being independently queryable in SQL. If later phases need to query
by `authored_by` or `subtype`, a migration can promote them to columns.

LLM assistance is not rejected forever — it is scoped out of *this* path. Future
work may add **LLM-assisted ingestion** for unstructured sources (hospital
protocols, PDFs, deployment-context rules) as a separate capability that
produces structured data, which a physician then authors from. That is a
distinct concern from the authoring path and is out of scope for Phase A.

The no-auth decision is explicitly time-boxed to Phase A and must be revisited
before any public, multi-contributor deployment (Phase D).
