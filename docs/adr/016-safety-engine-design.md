# ADR-016: Safety Engine Design

**Date:** 2026-04-11
**Status:** Accepted

## Context
ClinicalGuard evaluates AI-generated clinical responses across multiple 
dimensions. Not all dimensions carry the same risk. A contraindication 
violation is categorically different from an incomplete treatment plan. 
Treating them the same way, whether both go through an LLM judge or both 
through deterministic code, produces a system that is either too slow for 
safety-critical checks or too rigid for quality assessment.

## Decision
The evaluation engine is split into two sequential layers.

The first layer is the deterministic safety rule engine. It checks binary 
contraindications, known drug interactions, and absolute clinical thresholds. 
These checks run as code, not LLM calls. A rule either fires or it does not. 
CRITICAL rules that fire short-circuit the second layer entirely and mark the 
response as unacceptable without further scoring.

The second layer is the LLM-as-judge scorer. It evaluates completeness, 
protocol adherence, citation accuracy, and treatment correctness. These 
dimensions require contextual reasoning that deterministic code cannot 
provide reliably. This layer only runs if the first layer does not fire a 
CRITICAL rule.

## Consequences
Deterministic rules are fast, reliable, and cannot be suppressed for CRITICAL 
severity. LLM-as-judge scoring is flexible but slower and has a configurable 
passing threshold. Running deterministic checks first means safety violations 
are caught immediately without incurring LLM latency or cost. The tradeoff is 
that the two layers must be maintained separately and tested independently.