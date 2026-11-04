---
agent: product-contract-verifier
triggers:
  - "verify product contract"
  - "product contract verification"
  - "check product contract"
conditions:
  - "An accepted product contract exists from Product Quest"
  - "Implementation is complete (or the relevant unit is complete)"
  - "Before generating changelog"
delegation: subagent_run
---

# Routing for product-contract-verifier

## When to Use

Delegate to `product-contract-verifier` when **all** of the following hold:

1. A Product Quest has produced an **accepted** product contract for the current task
2. Implementation is complete (or the relevant unit is complete)
3. The next step would be generating the changelog

## How to Delegate

Use `subagent_run` with:
- `agent`: "product-contract-verifier"
- `task`: "Verify the product contract for [feature/task name]. Contract clauses: [list clause IDs]. Implementation scope: [diff summary or affected files]. ODD task document: [path]."
- `label`: "verify product contract"
- `mode`: "task"

## Inputs to Provide

The task description must include:
- The accepted product contract (or reference to ODD document section `## Product Contract`)
- Specific clause IDs to verify (all accepted clauses by default)
- Implementation scope (diff summary or list of affected files)
- Path to ODD task document and any relevant product docs
- Tests/evidence related to each clause
- Cross-referenced architectural contract clauses (AC-XX)

## Integration with ODD and RDD

The conceptual flow is:

```
1. Product Quest → accepted product contract
2. Authorized implementation
5. Product Contract Verifier → verifies product contract
6. If PASS → Changelog Generator → changelog + version proposals
7. Changelog Generator → presents to user for confirmation
8. User confirms → commit + tag + release
```

**Critical:** Product Contract Verifier runs BEFORE Changelog Generator for the candidate. If code changes after Verifier, re-run Verifier on the modified state before Changelog Generator.

## Verifier Does NOT Replace

- `gentle-ai-verify` (functional/structural verification per risk tier)
- RDD native review (risk assessment, lens selection, consent, refutation, correction, validation)
- `review-risk` lens (architecture, dependencies, security, permissions — covered by RDD)

Verifier verifies **only** the Product Quest contract. RDD evaluates **risk of the change** independently.

## Verifier Does NOT Replace

- `gentle-ai-verify` (functional/structural verification per risk tier)
- RDD native review (risk assessment, lens selection, consent, refutation, correction, validation)
- `review-risk` lens (architecture, dependencies, security, permissions — covered by RDD)

Verifier verifies **only** the Product Quest contract. RDD evaluates **risk of the change** independently.