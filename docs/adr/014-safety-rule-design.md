# ADR-014: Safety Rule Design

**Date:** 2026-04-02
**Status:** Accepted

## Context
Safety rules are the most clinically sensitive part of ClinicalGuard. 
A wrong safety rule is worse than no safety rule. The design must be 
precise, verifiable, and extensible across guideline datasets.

## Decision
Safety rules are divided into two types. Universal rules apply regardless 
of which guideline dataset is active. Examples include emergency escalation 
triggers and rules about concurrent drug administration with known 
interactions. Dataset-specific rules apply only when a particular guideline 
is active. Examples include maximum dosing thresholds and first-line 
treatment requirements from that guideline.

Three severity tiers govern how rules fire. CRITICAL rules cannot be 
dismissed. In CDS mode the clinician must open and acknowledge the card 
before proceeding. In eval mode a CRITICAL rule firing marks the AI 
response as unacceptable and triggers escalation. WARNING rules surface 
a strong signal in both modes but do not block. INFO rules provide 
supporting context that can safely be ignored.

All safety rules require verification by a licensed clinician before 
the is_verified flag is set to true. Unverified rules are stored but 
never fire in production. For NSTG, verification is performed by the 
project author.

Guideline-specific rules are ingested alongside the guideline via the 
adapter. User-defined rules and multi-tenancy schema implications are 
deferred to a separate ADR before Phase 2 implementation begins.

Organization-specific rules, allowing individual hospitals or health systems to define their own rule sets that override or extend the dataset defaults, are a planned extension documented in ADR-015.

## Consequences
The safety rule design touches multiple layers of the system. The schema 
requires a rule execution order field and a user_id foreign key for 
user-defined rules in future. The eval engine must run deterministic 
rules before LLM-as-judge scoring. The CDS response structure must 
include a flags array for fired rules. These dependencies must be 
resolved before the safety engine is built.