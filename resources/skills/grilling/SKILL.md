---
name: grilling
description: "Trigger: grill, stress-test plan, bounded interview. Grill the user with one focused question at a time about a plan, decision, or idea, within a hard 50-question budget. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases. User-invoked only — never invoked by a model automatically."
disable-model-invocation: true
license: MIT
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# Grilling — Bounded Interview Primitive

## Activation Contract

**Use this skill when:**
- User explicitly starts a grilling session (`/grill-me`, "grill me", "grill my plan")
- User wants to stress-test a plan, design, or decision before committing
- User wants bounded interview to sharpen alignment

**Do NOT use this skill for:**
- Automatic model invocation (enforced by `disable-model-invocation: true`)
- Continuous or unbounded interviewing
- Replacing `grill-me` entry point

## Hard Rules

| Rule | Description |
|------|-------------|
| **Hard question budget = 50** | MUST NOT ask more than 50 questions in one grilling session. |
| **One question at a time** | Ask exactly ONE focused question, wait for answer, follow branch to resolution. |
| **Plan before you ask** | Design question path first; highest-impact decisions first; sum ≤ 50. |
| **User-invoked only** | Never trigger automatically; only act when human starts grilling. |
| **Facts are your job** | Dispatch sub-agents for facts; don't ask user for lookup-able info. |
| **No stack/framework drag** | Frame questions around behavior, inputs, outputs, invariants — not "which framework". |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Budget exhausted (50 questions) | Stop, consolidate, list pending branches, ask for new session |
| User wants to continue past budget | Start fresh session, not extension |
| Question needs fact | Dispatch sub-agent, don't ask user |
| Stack/framework decision needed | Frame as user decision, not assumption |

## Execution Steps

### Step 1 — Design the question path (before asking anything)

1. Enumerate every decision branch in the plan/design.
2. Rank by **impact × uncertainty**: highest scope/architecture/effort impact first.
5. Assign question count per branch. **Sum ≤ 50**. Consolidate/defer if over.
4. Respect dependencies: downstream questions wait for prerequisites.
5. Dispatch sub-agents for facts; don't ask user for lookup-able info.
6. Frame questions around behavior, invariants, contracts — not "which framework".

### Step 2 — Run the interview, one question at a time

1. Current question = highest-priority unresolved branch with settled prerequisites.
2. Ask exactly ONE question with recommended answer. **STOP and wait**.
6. Follow answer down its branch — resolve sub-decisions before returning.
7. Recompute remaining branch priorities after each answer.
8. Watch budget: allocate for remaining questions. **Stop at 50**.

### Step 3 — Consolidate and hand off

Session ends when:
- All branches resolved, OR
- 50 questions used (budget exhausted).

If budget exhausted before tree empty:
1. **Consolidate** covered branches into shared-understanding summary.
2. **List pending branches** explicitly as follow-ups.
3. Present summary + unresolved blockers to user.
4. **Ask explicit acceptance** before proceeding.

**Do not act on plan without explicit user approval.** Past budget = new session, not extension.

## Output Contract

Return:
- Shared-understanding summary
- Pending/unresolved branches as explicit follow-ups
- Explicit user confirmation required before proceeding

## References

- `grill-me` skill — User-invoked entry point for grilling sessions