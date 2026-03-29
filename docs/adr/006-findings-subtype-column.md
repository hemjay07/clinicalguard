# ADR-006: Subtype Column on Findings, Treatments, and Complications

**Date:** 2026-03-29
**Status:** Accepted

## Context
A single condition can have distinct clinical subtypes that present and are managed 
differently. Abortion has five subtypes: Threatened, Inevitable, Incomplete, Missed, 
and Recurrent. Each has different findings, different treatments, and different 
complications. Storing all rows under the condition alone, without tracking which 
subtype they belong to, would make it impossible to distinguish between them at 
query time.

## Decision
A nullable subtype column is added to condition_findings, condition_treatments, and 
condition_complications. A null subtype means the row applies to the condition 
regardless of subtype. A populated subtype means the row applies only to that 
specific clinical classification. Subtype is distinct from severity_tier, which 
tracks clinical severity independently.

## Consequences
Enables the eval engine to verify subtype-specific correctness. When an AI response 
recommends treatment for Incomplete Abortion, the system can check that recommendation 
against the rows specifically tagged for that subtype, not against all abortion 
treatments combined. Without this column, that level of precision is not possible.