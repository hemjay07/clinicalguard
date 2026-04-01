# ADR-012: Retrieval Limitations and Phase 3 Benchmark Plan

**Date:** 2026-04-01
**Status:** Accepted, to be revisited in Phase 3

## Context
Phase 1 retrieval testing revealed specific failure cases. Constitutional symptom 
queries, where the clinical picture is defined by a combination of common symptoms 
rather than specific ones, underperform. Tuberculosis is the canonical example: 
productive cough, night sweats, and weight loss are individually common but 
together are pathognomonic for TB. The retrieval pipeline initially ranked 
Pulmonary Tuberculosis 17th for this query.

## Decision
Accept these limitations for Phase 1. Address them systematically in Phase 3 
with a retrieval benchmark suite using real clinical queries with known correct 
answers.

Known limitations accepted for Phase 1:
- BM25 index rebuilt per query, needs caching for production scale
- No reranking step, cross-encoder reranking deferred to Phase 2
- No query expansion for clinical abbreviations and synonyms
- No metadata filtering by age group or condition category
- Constitutional symptom queries underperform without HyDE

## Consequences
HyDE was added to address the TB failure. With HyDE enabled, Pulmonary 
Tuberculosis moved from overall rank 17 to rank 6, with semantic rank 1. 
BM25 still fails to find TB because the constitutional symptoms do not appear 
verbatim in the guideline text. This confirms reranking is the next priority 
improvement.

Phase 3 benchmark will measure precision at 5 for a suite of 20 to 30 clinical 
queries across all known failure categories. Each optimization will be measured 
against the baseline before merging.