# Clinical Safety Policy

## Purpose

ClinicalGuard is a clinical decision support and evaluation framework. It is 
designed to assist clinicians and developers in evaluating AI-generated clinical 
responses against established treatment guidelines. It is not a replacement for 
clinical judgment.

## What ClinicalGuard Provides

ClinicalGuard provides three things:

1. **A baseline rule set** derived from the Nigerian Standard Treatment 
   Guidelines (NSTG 2022). These ship with the framework as the reference 
   implementation.

2. **A standard for safety rules.** Format, verification requirements, and 
   severity tiers that any organisation can follow when writing their own rules.

3. **Infrastructure for extension.** Organisations deploying ClinicalGuard can 
   add their own rules on top of the baseline, disable rules that do not apply 
   to their context, and set their own verification standards for 
   organisation-specific rules.

ClinicalGuard does not dictate what an organisation's rules say. It dictates 
how rules are structured and verified.

## Safety Rule Standards

All safety rules in ClinicalGuard must meet the following standards before 
activation:

1. **Documented source.** Every rule must reference its origin. This can be a 
   published treatment guideline, a pharmacological reference, or an 
   organisation-specific clinical protocol. The source must be explicitly 
   documented regardless of origin. Rules without a documented source will not 
   be activated.

2. **Clinician verification.** Every rule must be reviewed and confirmed by a 
   licensed clinician familiar with the source material before the `is_verified` 
   flag is set to true. Unverified rules are stored in the database but never 
   fire in production.

3. **Conservative severity assignment.** When in doubt between WARNING and 
   CRITICAL, assign CRITICAL. It is safer to over-alert than to under-alert 
   in a clinical context.

4. **No fabrication.** Rules must reflect what the source explicitly states. 
   Inferred or extrapolated rules require explicit clinical review and 
   documentation of the reasoning before activation.

## Deploying Organisation Responsibilities

Organisations deploying ClinicalGuard are responsible for:

- Verifying that all active safety rules are appropriate for their clinical 
  context, patient population, and jurisdiction
- Ensuring organisation-specific rules meet the same verification standards 
  as baseline rules
- Appointing a clinician responsible for safety rule oversight within their 
  deployment
- Reviewing rules when source guidelines are updated

ClinicalGuard provides the standard and the infrastructure. The deploying 
organisation owns the clinical responsibility for their instance.

## Current Limitations

The NSTG safety rules shipped with this framework were extracted from the 
Nigerian Standard Treatment Guidelines 2022 and reviewed to the best of the 
maintainer's ability. The maintainer acknowledges the following limitations:

- The initial rule set covers only the highest-risk scenarios identified 
  during Phase 2 development. Comprehensive coverage of all 251 conditions 
  is a future goal.
- Community verification is actively encouraged. If you are a licensed 
  clinician and identify an error, incomplete rule, or missing rule, please 
  open an issue or pull request. See CONTRIBUTING.md for the verification 
  workflow.
- Rules derived from NSTG 2022 reflect Nigerian clinical practice guidelines. 
  They may not be appropriate for other jurisdictions without review by a 
  clinician familiar with local standards.

## Disclaimer

ClinicalGuard is a software framework for clinical AI evaluation. It is not 
a certified medical device. Regulatory approval has not been sought. It does 
not provide medical advice. Clinical decisions must always be made by 
qualified healthcare professionals using their own judgment.

The safety rules in this framework are derived from publicly available 
treatment guidelines and are provided for informational and evaluation 
purposes only. The framework maintainers accept no liability for clinical 
decisions made using this system.

## Verification Workflow for Contributors

If you are a licensed clinician who wants to contribute safety rules:

1. Identify the source material and specific section
2. Write the rule in plain language
3. Open a pull request using the safety rule template in `docs/templates/`
4. Tag the PR with `safety-rule` and `needs-clinical-review`
5. A maintainer will format the rule into the structured schema
6. The contributing clinician confirms the formatted version
7. A second clinician reviewer signs off where possible
8. The rule is merged with `is_verified = true`

## Contact

For clinical safety concerns, open an issue tagged `clinical-safety` on GitHub.