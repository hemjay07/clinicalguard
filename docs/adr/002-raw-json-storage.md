# ADR-002: Why raw json storage 

**Date:** 2026-03-29  
**Status:** Accepted

## Context
We have decided to store both raw json of the guideline or resource we are using for the thinking 

## Decision
The reason for this decision is becuase we cant guarantee the sturcutre of the data that will be plugged into the framework but having the raw data means we get the flexibilithy to use a personalized adapter (LLM powered for some specific funcaionlity--LLM assisted ETL) and human in the loop for safety critical content to extract the data into our db

## Consequences
THis create an extra layer of work and LLM cost in some case but it is unescapable as its fundamental to the output of the framework