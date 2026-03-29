# ADR-005: Tiered Human Verification for Extracted Clinical Data

**Date:** 2026-03-29
**Status:** Accepted

## Context
Clinical data extracted from guidelines varies in risk level. An error in a condition 
name is a minor data quality issue. An error in a safety rule or contraindication is 
a clinical risk. Applying the same verification standard to all extracted data would 
either create an unsustainable review burden or leave safety-critical content 
unverified.

## Decision
Extracted data is verified in three tiers based on clinical risk. Condition names, 
ICD codes, and source metadata are accepted as extracted with no human review. 
Treatment recommendations are extracted by LLM with spot-check sampling by a 
clinician. Safety rules and contraindications require mandatory verification by a 
licensed clinician familiar with the source guidelines before they are marked active 
in the system. For NSTG, that clinician is the project author. For third-party 
adapters, verification is the responsibility of the institution deploying the adapter.

## Consequences
Scales clinical verification to where it matters most without requiring full manual 
review of every extracted field. Institutions adopting the framework bear 
responsibility for verifying their own safety rules, which is the correct division 
of responsibility for a safety-critical system.