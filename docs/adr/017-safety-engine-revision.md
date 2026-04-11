# ADR-017: Safety Engine Revised Architecture

**Date:** 2026-04-11
**Status:** Accepted

## Context
ADR-016 proposed keyword matching for deterministic rule evaluation. After 
implementation review, keyword matching has two fatal flaws: false positives 
on correct responses that warn against a drug, and it does not scale because 
each new rule requires code changes. A better approach is needed that handles 
both condition-specific and universal rules at any scale.

## Decision
Rule evaluation uses two stages.

Stage 1 is a fast pre-filter. Condition-specific rules are filtered by 
matching against the condition IDs returned by retrieval. Universal rules 
(null condition_id) are always included regardless of which conditions were 
retrieved. This narrows the full rule set to the small relevant subset for 
any given query.

Stage 2 is a single batched LLM call. The filtered rules and the AI response 
are passed to a language model together. The model evaluates each rule and 
returns structured JSON: rule_id, fired (boolean), and reason. The rule 
description itself is the evaluation criterion. No code changes are needed 
to add new rules.

## Consequences
Scales to thousands of rules without code changes. Semantically aware, 
eliminating false positives from keyword co-occurrence. Universal rules 
ensure cross-condition safety checks always run. Adds LLM latency and 
cost per evaluation, which is acceptable at gpt-4o-mini pricing given 
the pre-filter reduces the rule set significantly before any LLM call.