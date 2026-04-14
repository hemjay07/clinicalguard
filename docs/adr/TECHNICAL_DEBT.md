# Technical Debt

Known shortcuts and deferred work that must be addressed before production deployment.

## Before Phase 3

- **Test separation:** Unit and integration tests are not separated. 
  Integration tests (eval scorer, retrieval) make real LLM and database 
  calls and are slow. Separate with pytest markers. Run integration tests 
  on a schedule, not every push.

- **Dedicated test database:** Tests run against the production Supabase 
  database with session rollback. A separate TEST_DATABASE_URL is needed 
  to prevent any risk of production data contamination. See ADR-008.

## Before Production

- **Alembic history:** Initial schema was created with create_all and manual 
  ALTER TABLE before Alembic was set up. The baseline migration is a no-op. 
  A clean migration history would rebuild the schema from scratch through 
  Alembic only.

- **BM25 index caching:** BM25 index is rebuilt from scratch on every query. 
  At scale this is unacceptable. Index should be built once at startup and 
  cached in memory. See ADR-012.

- **Structured drug extraction:** Treatment drug instructions are stored as 
  raw text strings. Structured extraction using RxNorm cross-referencing is 
  deferred to Phase 3. See ADR-004.

- **Comprehensive safety rule coverage:** Current rule set covers 9 
  high-risk scenarios identified during Phase 2. Full coverage of all 251 
  conditions requires systematic clinical review. Community contribution 
  workflow is documented in CLINICAL_SAFETY_POLICY.md.

## Deferred to Phase 3

- Retrieval benchmark suite with precision at 5 measurement
- Reranking step with cross-encoder
- Query expansion for clinical abbreviations
- Metadata filtering by age group and condition category
- Embedding strategy benchmark: FINDINGS_FOCUSED vs COMPREHENSIVE
- Contextual scoring logic for organisation-specific eval cases