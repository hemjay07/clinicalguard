# ADR-001: Database Choice

**Date:** 2026-03-29  
**Status:** Accepted

## Context
ClinicalGuard is a production framework, not a prototype. It requires vector search 
for semantic retrieval and will serve concurrent API users at deployment. The database 
choice needed to support both from day one, not as an afterthought.

## Decision
We chose PostgreSQL over SQLite. SQLite cannot handle concurrent writes and has no 
native vector support, requiring separate tooling for both. PostgreSQL with the 
pgvector extension handles relational data and vector similarity search in a single 
system, with production-grade connection pooling built in. We use Supabase as the 
managed host to stay within zero-budget constraints.

## Consequences
Enables semantic search, concurrent writes, and connection pooling without additional 
services. The tradeoff is network latency versus SQLite's local file access, which is acceptable because ClinicalGuard will be deployed both as a Python library and a REST API, not as an embedded local tool.