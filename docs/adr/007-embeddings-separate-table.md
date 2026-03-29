# ADR-007: Embeddings in a Separate Table

**Date:** 2026-03-29
**Status:** Accepted

## Context
Embeddings are infrastructure, not clinical data. They are generated from clinical 
content using a specific model and will need to be regenerated when embedding models 
are updated or when the source text changes. Storing vectors directly on the 
conditions table would couple infrastructure operations to clinical data, meaning 
any embedding update would require modifying clinical data rows directly.

## Decision
Embeddings live in a dedicated condition_embeddings table with a foreign key back 
to conditions. Each row stores the embedding text, the model name, and the vector. 
A condition can have multiple embedding rows, one per model. Switching models means 
deleting rows where model_name matches the old model and inserting fresh rows. The 
conditions table is never touched.

## Consequences
Clinical data and embedding infrastructure are fully decoupled. Regenerating 
embeddings for a new model is a clean operation with no risk to clinical data 
integrity. Multiple embedding models can coexist, which enables benchmarking 
retrieval quality across models before committing to one.