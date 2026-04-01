# ADR-011: Hybrid Retrieval and Reciprocal Rank Fusion

**Date:** 2026-04-01
**Status:** Accepted

## Context
Clinical queries take two forms: symptom descriptions where meaning matters 
more than exact words ("child with difficulty breathing and wheeze"), and 
terminology-specific queries where exact clinical terms matter ("artemether-
lumefantrine dosing"). Pure semantic search handles the first well but misses 
exact drug names and clinical codes. Pure BM25 handles the second well but 
fails when the clinician's words don't appear verbatim in the guideline text.

## Decision
Hybrid retrieval combining pgvector semantic search and BM25 keyword search, 
fused using Reciprocal Rank Fusion with k=60. Each method retrieves the top 20 
candidates independently. RRF combines the ranked lists by summing 1/(k+rank) 
per condition across both lists. k=60 is the empirically validated constant from 
Cormack et al. 2009, chosen to prevent top-ranked results from dominating when 
a condition only appears in one list. HyDE is available as an optional mode that 
generates a hypothetical clinical passage before embedding, improving recall for 
constitutional symptom queries.

## Consequences
Hybrid retrieval outperforms either method alone for most clinical queries. 
Conditions appearing in both ranked lists score higher than conditions dominating 
only one list. HyDE significantly improves constitutional symptom queries: TB 
moved from semantic rank 9 to rank 1 when HyDE was enabled. The tradeoff is 
latency: HyDE adds one LLM call per query and BM25 currently rebuilds its index 
per query. Both are flagged as Phase 2 optimizations.