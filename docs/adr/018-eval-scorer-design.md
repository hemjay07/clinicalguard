# ADR-018: Eval Scorer Design

**Date:** 2026-04-12
**Status:** Accepted

## Context
The eval scorer is the core differentiator of ClinicalGuard. It must be 
clearly scoped: what it evaluates, how it evaluates it, and what it 
explicitly does not claim to measure. Two reference points shaped this 
design: HealthBench (OpenAI's clinical AI benchmark) and Abridge's 
confabulation detection framework. HealthBench evaluates general medical 
knowledge using synthetic conversations. Abridge detects unsupported claims 
in clinical documentation using a purpose-built model trained on 50,000+ 
samples. ClinicalGuard operates in a different space: evaluating whether 
an AI response adheres to a specific guideline dataset in a specific 
deployment context.

## Decision
The eval scorer evaluates AI-generated clinical responses across four 
dimensions grounded in the structured NSTG database:

**Treatment correctness:** Are the treatments recommended in the AI response 
supported by the guideline? Each treatment claim is classified as supported 
(directly in condition_treatments), inferrable (reasonable clinical inference 
from the guideline), unsupported (no basis in the retrieved conditions), or 
contradicted (directly conflicts with the guideline).

**Investigation appropriateness:** Are the investigations recommended 
appropriate for the retrieved conditions? Evaluated against 
condition_investigations.

**Safety rule adherence:** Did the response violate any verified safety rules? 
Handled by the deterministic safety engine (ADR-016, ADR-017). This dimension 
is not LLM-evaluated.

**Completeness:** Did the response omit critical elements the guideline 
explicitly requires? First-line treatments, mandatory investigations, and 
safety warnings that should always be mentioned.

Claim-level traceability is a first-class requirement. Every flagged claim 
must link back to the specific condition, table, and text in the database 
that supports or contradicts it. This is the portable principle from 
Abridge's Linked Evidence approach: clinicians must be able to verify 
every flag against the source.

The scorer uses LLM-as-judge for dimensions 1, 2, and 4. The LLM maps 
free-text AI response claims to structured database entries and classifies 
them. Safety rule adherence uses the deterministic engine only.

## Consequences
ClinicalGuard evaluates guideline adherence, not clinical outcomes. A 
response that scores well means the AI followed the specified guidelines. 
It does not mean the guidelines are optimal, that the patient will have 
good outcomes, or that patient-specific factors have been accounted for. 
This is a deliberate and honest scope limitation, not a weakness. It is 
what makes the framework deployable without requiring EHR integration, 
longitudinal data, or outcome tracking. Organisations that need outcome 
measurement must build that layer on top of ClinicalGuard, not expect it 
from the framework itself.# ADR-018: Eval Scorer Design

**Date:** 2026-04-12
**Status:** Accepted

## Context
The eval scorer is the core differentiator of ClinicalGuard. It must be 
clearly scoped: what it evaluates, how it evaluates it, and what it 
explicitly does not claim to measure. Two reference points shaped this 
design: HealthBench (OpenAI's clinical AI benchmark) and Abridge's 
confabulation detection framework. HealthBench evaluates general medical 
knowledge using synthetic conversations. Abridge detects unsupported claims 
in clinical documentation using a purpose-built model trained on 50,000+ 
samples. ClinicalGuard operates in a different space: evaluating whether 
an AI response adheres to a specific guideline dataset in a specific 
deployment context.

## Decision
The eval scorer evaluates AI-generated clinical responses across four 
dimensions grounded in the structured NSTG database:

**Treatment correctness:** Are the treatments recommended in the AI response 
supported by the guideline? Each treatment claim is classified as supported 
(directly in condition_treatments), inferrable (reasonable clinical inference 
from the guideline), unsupported (no basis in the retrieved conditions), or 
contradicted (directly conflicts with the guideline).

**Investigation appropriateness:** Are the investigations recommended 
appropriate for the retrieved conditions? Evaluated against 
condition_investigations.

**Safety rule adherence:** Did the response violate any verified safety rules? 
Handled by the deterministic safety engine (ADR-016, ADR-017). This dimension 
is not LLM-evaluated.

**Completeness:** Did the response omit critical elements the guideline 
explicitly requires? First-line treatments, mandatory investigations, and 
safety warnings that should always be mentioned.

Claim-level traceability is a first-class requirement. Every flagged claim 
must link back to the specific condition, table, and text in the database 
that supports or contradicts it. This is the portable principle from 
Abridge's Linked Evidence approach: clinicians must be able to verify 
every flag against the source.

The scorer uses LLM-as-judge for dimensions 1, 2, and 4. The LLM maps 
free-text AI response claims to structured database entries and classifies 
them. Safety rule adherence uses the deterministic engine only.

## Consequences
ClinicalGuard evaluates guideline adherence, not clinical outcomes. A 
response that scores well means the AI followed the specified guidelines. 
It does not mean the guidelines are optimal, that the patient will have 
good outcomes, or that patient-specific factors have been accounted for. 
This is a deliberate and honest scope limitation, not a weakness. It is 
what makes the framework deployable without requiring EHR integration, 
longitudinal data, or outcome tracking. Organisations that need outcome 
measurement must build that layer on top of ClinicalGuard, not expect it 
from the framework itself.

Eval cases support two scoring modes. Baseline scoring evaluates against the 
published guideline and enables cross-organisation benchmarking. Contextual 
scoring evaluates against the guideline as modified by organisation-specific 
context: drug availability, formulary restrictions, care level, and local 
protocols. A hospital with limited drug availability may score lower on the 
baseline but appropriately high on contextual scoring because their AI 
correctly recommends what is actually available. Both scores together tell 
the full clinical story. The eval_cases schema supports this from day one 
with nullable contextual_ground_truth and organisation_id columns. Contextual 
scoring logic is deferred to Phase 3.