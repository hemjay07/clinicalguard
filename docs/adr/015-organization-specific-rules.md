# ADR-015: Organization-Specific Safety Rules

**Date:** 2026-04-02
**Status:** Accepted

## Context
Different deploying institutions have different clinical contexts. A teaching 
hospital, a rural primary care clinic, and a telehealth startup evaluating AI 
agents all have legitimate reasons to extend or override the default guideline 
safety rules. The framework needs to support this without ClinicalGuard managing 
the complexity of multi-tenancy.

## Decision
ClinicalGuard is a self-hosted framework. Each deployment has one organization 
representing the deploying institution. Multi-tenancy, where multiple 
organizations share one ClinicalGuard instance, is explicitly out of scope. 
Any institution requiring multi-tenancy is responsible for implementing it on 
top of the framework. ClinicalGuard does not manage data separation between 
organizations.

An organizations table is added with a single row per deployment. Safety rules 
attach to an organization via an organization_id foreign key. Organization-specific 
rules can extend or override dataset-specific rules for that deployment.

Rule execution order is: universal rules first, dataset-specific rules second, 
organization-specific rules third. Organization rules have the highest priority 
and can suppress or escalate rules from the layers below.

Organization context is passed into every query at runtime and treated as 
first-class context alongside guideline data.

## Consequences
Each ClinicalGuard deployment is fully isolated by design. A hospital deploying 
ClinicalGuard owns their own database, their own rules, and their own eval 
history. This keeps the framework simple and auditable. The tradeoff is that 
a SaaS deployment serving multiple organizations requires additional engineering 
by the deployer. That is a deliberate constraint, not a gap.