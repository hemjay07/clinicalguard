# ADR-008: Test Database Strategy

**Date:** 2026-03-30
**Status:** Accepted, to be revisited

## Context
Claude Architect (my prevoius project) used chunking to split long documents into overlapping windows for embedding. ClinicalGuard data is structured differently.

## Decision
no chunking. Each condition is a discrete clinical unit and is embedded as a whole. The embedding text is a constructed paragraph combining key fields, not a raw document slice.

## Consequences
simpler pipeline, no chunk overlap management, no chunk-to-condition mapping. The tradeoff is that very long conditions may have important details diluted in the embedding. This is acceptable for Phase 1 and will be validated in the Phase 3 retrieval benchmark.