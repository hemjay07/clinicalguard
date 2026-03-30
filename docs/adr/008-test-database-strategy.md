# ADR-008: Test Database Strategy

**Date:** 2026-03-30
**Status:** Accepted, to be revisited

## Context
ClinicalGuard has no budget for a separate test database. The correct approach 
is a dedicated test database with a separate TEST_DATABASE_URL so tests never 
touch production data. This is not currently possible on the free tier.

## Decision
Tests run against the production Supabase database. Each test uses a session 
that is rolled back after completion, preventing test data from persisting. 
Exact row count assertions are avoided in data quality tests because rollbacks 
from concurrent test sessions cause counts to shift.

## Consequences
Tests are slower due to network latency on every assertion. There is a small 
risk of data leakage if a session fails to roll back cleanly. This approach is 
acceptable for Phase 1 but must be replaced with a dedicated test database 
before Phase 3 when the eval suite runs hundreds of cases. This is tracked as 
technical debt.