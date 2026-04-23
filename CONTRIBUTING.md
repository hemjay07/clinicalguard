# Contributing to ClinicalGuard

ClinicalGuard is an open-source clinical AI evaluation framework. Contributions
are welcome, but clinical safety is a first-class concern. Read this document
before opening a pull request.

---

## Types of Contributions

### 1. Adding a New Guideline Dataset (Adapter Authors)

ClinicalGuard is designed to work with any clinical guideline dataset through
a pluggable adapter pattern. The NSTG adapter is the reference implementation
at `clinicalguard/ingestion/nstg.py`.

To add a new dataset:

**Step 1: Understand the schema.**
Every adapter maps source data into the same generic schema. Study the existing
tables before writing any code:

- `guideline_datasets` — one row per dataset, tracks name, version, country
- `conditions` — one row per clinical condition
- `condition_findings` — clinical features and symptoms
- `condition_treatments` — goals, non-drug measures, drug instructions, supportive measures
- `condition_investigations` — diagnostic workup ordered to confirm or rule out
- `condition_complications` — known complications
- `condition_prevention` — prevention measures
- `condition_differentials` — differential diagnoses
- `condition_adverse_reactions` — adverse drug reactions and cautions
- `condition_safety_rules` — verified safety rules (see safety rule section below)

**Step 2: Create your adapter.**
Create `clinicalguard/ingestion/{your_dataset}.py`. Your adapter must implement:

```python
def ingest_file(db: Session, filepath: Path) -> Condition:
    """Read one source file and map it into the generic schema."""
    ...
```

Follow the NSTG adapter pattern:
- Use `get_or_create_dataset()` to create the dataset record idempotently
- Use upsert logic: check if the condition exists, delete children, reinsert
- Store `raw_json` alongside structured fields for future extraction passes
- Log every insert and update at INFO level

**Step 3: Write a run script.**
Create `clinicalguard/ingestion/run_{your_dataset}.py` following
`run_ingestion.py` as the pattern. It should log a summary report at the end:
conditions succeeded, skipped, and failed.

**Step 4: Write tests.**
Add tests in `tests/test_ingestion/`. At minimum:
- One condition ingests without error
- Key fields are populated correctly
- Re-running ingestion does not duplicate records

**Step 5: Document the dataset.**
Add an ADR in `docs/adr/` explaining: why this dataset, what the source is,
licensing terms, and any known data quality issues.

---

### 2. Contributing Safety Rules

Safety rules are the most clinically sensitive part of ClinicalGuard. Read
`CLINICAL_SAFETY_POLICY.md` before contributing any rules.

**Who can contribute safety rules:**
Only licensed clinicians familiar with the source guidelines. Rules without
clinical verification will not be merged.

**The process:**

1. Identify the source guideline and specific section the rule comes from
2. Write the rule in plain language using `docs/templates/safety_rule_template.md`
3. Open a pull request tagged `safety-rule` and `needs-clinical-review`
4. A maintainer formats the rule into the seed script
5. You confirm the formatted version matches your clinical intent
6. A second clinician signs off where possible
7. Rule is added to `clinicalguard/safety/seed_rules.py` with `is_verified=True`

**What makes a valid safety rule:**

Safety rules are deterministic checks against harmful AI outputs. They are
appropriate for:
- Contraindications: drug X must not be given to patient population Y
- Known drug interactions: drug A must not be combined with drug B
- Absolute clinical thresholds requiring immediate action

They are NOT appropriate for:
- Completeness checks (did the AI mention all danger signs?)
- Protocol adherence (did the AI follow the correct sequence?)
- Clinical judgment calls

The second category belongs in the LLM-as-judge eval scorer, not the
deterministic safety engine. See ADR-016 and ADR-017 for the reasoning.

**Rule format:**
Condition: [condition name as it appears in the database]
Rule type: contraindication / drug_interaction / red_flag / dosing
Severity: CRITICAL / WARNING / INFO
Description: [plain language description of what the rule checks]
Action: [what should happen when this rule fires]
Source: [guideline name, version, and specific section or field]
Contributor: [your name and credentials]

---

### 3. General Code Contributions

**Before opening a PR:**
- Run the full test suite: `pytest tests/ -v`
- All existing tests must pass
- New features need tests

**Architecture decisions:**
If your contribution changes how a significant component works, write an ADR
in `docs/adr/` before writing code. The ADR should explain what you decided,
why, and what alternatives you considered. See existing ADRs for the format.

**Python style:**
- Type hints on all function signatures
- Docstrings are not required but why-not-what comments are encouraged
- Follow the patterns in existing files — SQLAlchemy sessions passed as
  parameters, not created inside functions

**Adding a new dependency:**
Add it to `pyproject.toml` with a minimum version pin. Explain why in the PR
description. We have a zero-budget deployment constraint — avoid dependencies
that require paid infrastructure.

---

## Development Setup

```bash
git clone https://github.com/hemjay07/clinicalguard.git
cd clinicalguard
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Copy `.env.example` to `.env` and fill in credentials:
DATABASE_URL=your_supabase_connection_string
OPENAI_API_KEY=your_openai_key

Run migrations and seed data:

```bash
alembic upgrade head
python -m clinicalguard.ingestion.run_ingestion
python -m clinicalguard.ingestion.run_embeddings
python -m clinicalguard.safety.seed_rules
```

Run tests:

```bash
pytest tests/ -v
```

---

## What Not to Do

- Do not add safety rules without clinical verification. Unverified rules that
  fire in production are worse than no rules.
- Do not store credentials or API keys in code or commit them to git.
- Do not use `create_all()` for schema changes. Use Alembic migrations.
- Do not add chunking to the embedding pipeline without reading ADR-010 first.
- Do not remove `raw_json` storage from the ingestion adapter. It is the
  safety net for incomplete structured extraction.

---

## Questions

Open an issue tagged `question`. For clinical safety concerns specifically,
tag the issue `clinical-safety`.

---

## Clinical Contributors

ClinicalGuard's evaluation infrastructure requires clinical review that a single
builder cannot produce at scale. We explicitly invite physician contribution.

**Case review.** Review existing NSTG-derived eval cases for clinical validity.
Flag over-specification, under-specification, or clinically unrealistic requirements.
The three current cases cover severe malaria, newly diagnosed T2DM, and newly
diagnosed hypertension. Open an issue with the `case-review` label.

**New case submission.** Contribute new eval cases grounded in specific NSTG
sections not yet covered. Use the expected_response schema documented in
`docs/methodology.md`. Cases live under
`clinicalguard/retrieval/eval_cases/nstg_derived/`. Open a PR with the new JSON
file and tag it `new-eval-case` and `needs-clinical-review`.

**Deployment-context validation.** If you work at a Nigerian hospital or clinic
and can validate cases against your institution's formulary and protocols,
contribute `contextual_overrides` to existing cases. This is the Layer 2
deployment-context work that requires on-the-ground knowledge no external reviewer
can provide.

**Institutional partnership.** ClinicalGuard is open for institutional partnerships
with the Nigerian Medical Association, teaching hospitals, or clinical AI deployment
projects. Contact the maintainer to discuss structured case development and
multi-physician calibration.

The literature on clinical AI evaluation is explicit about the infrastructure
required: NOHARM used 29 physicians and 12,747 annotations; Penda hired 30
physicians from 162 applicants with formal calibration gates. This is the standard
we're building toward, in public, with proper attribution to every contributor.

For clinical safety concerns, open an issue tagged `clinical-safety`.
