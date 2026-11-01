---
agent: architecture-council
triggers:
  - "verify architectural contract"
  - "architecture council"
  - "check architecture contract"
  - "verify quest contract"
conditions:
  - "An accepted architectural contract exists from Architecture Quest"
  - "Implementation is complete and Verify has run (when applicable)"
  - "Before invoking native RDD review for the candidate"
delegation: subagent_run
---

# Routing for architecture-council

## When to Use

Delegate to `architecture-council` when **all** of the following hold:

1. An Architecture Quest has produced an **accepted** architectural contract for the current task
2. Implementation is complete (or the relevant unit is complete)
3. `gentle-ai-verify` has run when applicable per native rules
4. The next step would be invoking the native RDD review for the candidate

## How to Delegate

Use `subagent_run` with:
- `agent`: "architecture-council"
- `task`: "Verify the architectural contract for [feature/task name]. Contract clauses: [list clause IDs]. Implementation scope: [diff summary or affected files]. Verify results: [summary]. ODD task document: [path]."
- `label`: "verify architecture contract"
- `mode`: "task"

## Inputs to Provide

The task description must include:
- The accepted architectural contract (or reference to ODD document section `## Architectural Contract`)
- Specific clause IDs to verify (all accepted clauses by default)
- Implementation scope (diff summary or list of affected files)
- Summary of Verify results (if available)
- Path to ODD task document and any relevant ADRs
- Tests/evidence related to each clause

## Integration with ODD and RDD

The conceptual flow is:

```
1. Architecture Quest → accepted contract
2. Authorized implementation
3. gentle-ai-verify (when native rules require it)
4. Architecture Council → verifies contract
5. If PASS → continue to native RDD per its configuration and candidate boundaries
6. RDD determines risk, lenses, consent, and review lifecycle via its own mechanisms
```

**Critical:** Council runs BEFORE RDD for the candidate. Council does not modify the candidate. If code changes after Council, re-run Council on the modified state before RDD.

## Council Does NOT Replace

- `gentle-ai-verify` (functional/structural verification per risk tier)
- RDD native review (risk assessment, lens selection, consent, refutation, correction, validation)
- `review-risk` lens (architecture, dependencies, security, permissions — covered by RDD)

Council verifies **only** the Quest contract. RDD evaluates **risk of the change** independently.