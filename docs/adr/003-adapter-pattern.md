# ADR-003: Adapter Pattern for Dataset Ingestion

**Date:** 2026-03-29
**Status:** Accepted

## Context
Different guideline datasets have fundamentally different structures. NSTG uses 
typed clinical features. WHO guidelines use different field names and hierarchies. 
NHS guidelines differ again. A single hardcoded ingestion pipeline would break with 
every new dataset.

## Decision
Each dataset gets a dedicated adapter responsible for reading the source format and 
mapping it into the generic schema. The adapter handles parsing, LLM-assisted 
extraction where needed, and validation before writing to the database. The core 
engine never knows which dataset it is processing, only that the adapter has produced 
valid structured data.

## Consequences
Each new dataset requires a new adapter. The overhead is acceptable because the 
adapter interface will be publicly documented, allowing third parties to write their 
own adapters for their guideline sources without modifying the core framework. This 
is what makes ClinicalGuard extensible rather than NSTG-specific.