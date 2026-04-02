# ClinicalGuard

An open-source clinical AI safety framework built on real Nigerian clinical 
guidelines (phase 1 complete).

## What it is

ClinicalGuard evaluates and supports clinical AI systems against structured 
medical guidelines. It ships with the Nigerian Standard Treatment Guidelines 
(NSTG 2022, 251 conditions) as the first dataset and is designed to support 
additional guideline datasets through a pluggable adapter pattern

It operates in two modes:

- **CDS mode:** returns guideline-backed recommendations for clinical queries 
  with citations
- **Eval mode:** scores AI-generated clinical responses against guidelines for 
  safety, completeness, and faithfulness

## Why it exists

Clinical AI evaluation is different from generic AI evaluation. Existing tools 
do not account for safety rules, clinical protocols, and guideline adherence. 
ClinicalGuard does.

## Architecture

**Foundation:** PostgreSQL with pgvector on Supabase. Each guideline dataset 
is ingested through a dataset-specific adapter that maps source data into a 
generic schema. The schema is designed for extensibility: adding a new guideline 
dataset requires only a new adapter. Architectural decisions are documented in 
`docs/adr/`.

**Retrieval:** Hybrid search combining pgvector semantic search and BM25 keyword 
matching, fused using Reciprocal Rank Fusion. HyDE (Hypothetical Document 
Embeddings) is available as an optional mode that improves recall for 
constitutional symptom queries. In testing, HyDE moved Pulmonary Tuberculosis 
from rank 17 to rank 6 for the query "productive cough, night sweats, weight loss."

**Intelligence:** Clinical reasoning engine and safety rules. Phase 2, in progress.

**API and frontend:** REST API and eval dashboard. Phase 3, planned.

## Current state

Phase 1 (Foundation) is complete:

- PostgreSQL with pgvector, 13 tables
- 251 NSTG conditions ingested with findings, treatments, complications, 
  differentials, prevention measures, and adverse reactions
- Hybrid retrieval pipeline with HyDE support
- 10 tests passing in CI
- 8 ADRs documenting all major architectural decisions

Phase 2 (Intelligence) is next.

## Getting started
```bash
git clone https://github.com/hemjay07/clinicalguard.git
cd clinicalguard
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Copy `.env.example` to `.env` and fill in your credentials:
```
DATABASE_URL=your_supabase_connection_string
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

Run migrations and ingest the dataset:
```bash
python -m clinicalguard.db.migrate
python -m clinicalguard.ingestion.run_ingestion
python -m clinicalguard.ingestion.run_embeddings
```

## Dataset

Built on the Nigeria Clinical Guidelines Dataset curated by 
[Chisom Rutherford](https://twitter.com/ruthefordml). 
Available on [HuggingFace](https://huggingface.co/datasets/chisomrutherford/nigeria-clinical-guidelines-dataset). 
Licensed under CC BY 4.0.
