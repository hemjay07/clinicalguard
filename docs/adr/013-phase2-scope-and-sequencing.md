# ADR-013: Phase 2 Scope and Sequencing

**Date:** 2026-04-02
**Status:** Accepted

## Context
Phase 1 delivered the data foundation: ingestion, embeddings, and hybrid 
retrieval. Phase 2 is the intelligence layer. Without a defined scope, 
work will sprawl and the eval engine will never ship.

## Decision
Phase 2 will deliver the following in sequence:

Alembic migration setup to replace manual ALTER TABLE statements. This 
unblocks safe schema changes for the rest of Phase 2.

Structured drug extraction from raw treatment strings using an LLM pass. 
Currently treatments are stored as free text. Phase 2 extracts drug name, 
dose, route, and frequency into structured fields.

CDS response structure: a defined JSON schema for what the system returns 
given a clinical query. This is the contract between the retrieval layer 
and the eval layer.

First 10 safety rules written manually and verified against NSTG by a 
clinician. These seed the deterministic safety rule engine.

Deterministic safety rule engine that evaluates any clinical response 
against the active rule set and returns fired rules with severity.

LLM-as-judge eval scorer for treatment correctness and completeness, 
running after the deterministic engine.

Dedicated test database to replace the current pattern of rolling back 
against production.

## Consequences
This scope is the minimum for Phase 2. New ADRs will be written for 
architectural decisions that emerge during implementation. The scope 
listed here is a floor, not a ceiling.