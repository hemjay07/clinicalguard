# ADR-008: Test Database Strategy

**Date:** 2026-03-30
**Status:** Accepted, to be revisited

## Context
embedding strategy determines what text gets embedded per condition, which directly affects retrieval quality. Different use cases require different strategies.

## Decision
 implement configurable embedding strategies via EmbeddingStrategy enum. Default to COMPREHENSIVE which includes name, introduction, findings, complications, and adverse reactions. Exclude treatments, goals, and prevention to avoid dilution.

## Consequences
strategy is benchmarkable. Phase 3 retrieval eval suite will compare strategies with real queries and pick the best performing default. Third party adapters can specify their own strategy.