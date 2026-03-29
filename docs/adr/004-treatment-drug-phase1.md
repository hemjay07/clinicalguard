# ADR-004: Storing Raw Strings for Treatment and Drug Data

**Date:** 2026-03-29
**Status:** Accepted

## Context
Treatment and drug instructions in NSTG come as free text strings with implicit 
protocol ordering and conditional logic. Simple parsing cannot reliably extract 
drug name, dose, route, and sequence without destroying that clinical meaning. 
Structured extraction requires LLM assistance and clinical verification by a doctor.

## Decision
Store treatment and drug instructions as raw strings in Phase 1, preserving the 
full protocol text exactly as it appears in the guideline. Structured extraction 
into discrete fields will be handled in Phase 2 using LLM-assisted parsing with 
clinical verification for safety-critical content.

## Consequences
Phase 1 eval can only assess completeness, whether a response mentions the right 
treatments, not protocol adherence, whether it follows the correct sequence and 
conditionals. This is a known limitation. Protocol adherence evaluation is a 
Phase 2 concern once the core infrastructure is proven end to end.