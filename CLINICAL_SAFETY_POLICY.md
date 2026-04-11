# Clinical Safety Policy

## Purpose

ClinicalGuard is a clinical decision support and evaluation framework for 
evaluating AI-generated clinical responses against treatment guidelines. It 
is not a replacement for clinical judgment and is not a certified medical 
device. Regulatory approval has not been sought.

## What ClinicalGuard Provides

Three things:

1. **A baseline rule set** derived from the Nigerian Standard Treatment 
   Guidelines (NSTG 2022) as the reference implementation.

2. **A standard for safety rules.** Format, verification requirements, and 
   severity tiers that any organisation can follow when writing their own rules.

3. **Infrastructure for extension.** Organisations can add their own rules, 
   disable rules that do not apply to their context, and set their own 
   verification standards.

ClinicalGuard defines how rules are structured and verified. Deploying 
organisations define what their rules say.

## What Safety Rules Are and Are Not

Safety rules are deterministic checks against harmful AI outputs. They are 
binary: a rule either fires or it does not.

**Appropriate for safety rules:**
- Contraindications: drug X must not be given to patient population Y
- Known drug interactions: drug A must not be combined with drug B
- Absolute clinical thresholds requiring immediate action

**Not appropriate for safety rules:**
- Completeness checks (did the AI mention all danger signs?)
- Protocol adherence (did the AI follow the correct sequence?)
- Clinical judgment calls

The second category belongs in the LLM-as-judge eval scorer. Mixing the two 
creates rules that cannot be reliably evaluated by code alone.

## Safety Rule Standards

Every rule must meet these standards before activation:

1. **Documented source.** Guideline, pharmacological reference, or 
   organisation protocol. Rules without a source will not be activated.

2. **Clinician verification.** Reviewed and confirmed by a licensed clinician 
   before `is_verified` is set to true. Unverified rules are stored but never 
   fire in production.

3. **Conservative severity.** When in doubt between WARNING and CRITICAL, 
   assign CRITICAL.

4. **No fabrication.** Rules must reflect what the source explicitly states. 
   Inferred rules require documented clinical reasoning.

## Deploying Organisation Responsibilities

Organisations are responsible for:

- Verifying rules are appropriate for their clinical context and jurisdiction
- Appointing a clinician responsible for safety rule oversight
- Reviewing rules when source guidelines are updated

ClinicalGuard provides the standard and infrastructure. The deploying 
organisation owns the clinical responsibility for their instance.

## Current Limitations

- The initial rule set covers only the highest-risk scenarios identified 
  during Phase 2. Comprehensive coverage is a future goal.
- NSTG 2022 rules reflect Nigerian clinical practice and may not be 
  appropriate for other jurisdictions without local clinical review.
- Community verification is actively encouraged. See CONTRIBUTING.md.

## Disclaimer

The safety rules in this framework are provided for informational and 
evaluation purposes only. The framework maintainers accept no liability 
for clinical decisions made using this system. Clinical decisions must 
always be made by qualified healthcare professionals.

## Contributing Safety Rules

1. Identify the source and specific section
2. Write the rule in plain language using `docs/templates/safety_rule_template.md`
3. Open a pull request tagged `safety-rule` and `needs-clinical-review`
4. A maintainer formats the rule into the structured schema
5. The contributing clinician confirms the formatted version
6. A second clinician signs off where possible
7. Rule is merged with `is_verified = true`

For clinical safety concerns, open an issue tagged `clinical-safety`.