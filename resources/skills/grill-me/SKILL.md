---
name: grill-me
description: "Trigger: bounded interview, grilling session, stress-test plan. A deliberate, bounded interview to sharpen a plan or design before committing. User-invoked only — the human starts it. Never model-invoked."
disable-model-invocation: true
license: MIT
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# grill-me — user-invoked grilling entry point

## Activation Contract

**Use this skill when:**
- User explicitly requests a grilling session (`/grill-me`, "grill me", "grill my plan")
- User wants to stress-test a plan, design, or decision before committing
- User wants bounded interview to sharpen alignment

**Do NOT use this skill for:**
- Automatic model invocation (enforced by `disable-model-invocation: true`)
- Continuous or unbounded interviewing
- Replacing `grilling` skill's internal interview logic

## Hard Rules

| Rule | Description |
|------|-------------|
| **User-invoked only** | Never triggered automatically by model. Human must explicitly start. |
| **Bounded session** | Maximum 50 questions per session. |
| **Delegates to grilling** | Loads and follows `grilling` skill for interview primitive. |
| **No auto-continuation** | Past 50 questions requires fresh session, not extension. |

## Decision Gates

| Situation | Action |
|-----------|--------|
| User types `/grill-me` | Load `grilling` skill, start interview |
| Budget exhausted (50 questions) | Stop, summarize, ask for new session |
| User wants to continue | Start fresh session, not extension |

## Execution Steps

1. **Load grilling skill** — Call `skill()` tool with `grilling` skill.
2. **Start interview** — Follow grilling's design-tree + 50-question budget discipline.
3. **One question at a time** — Ask exactly ONE focused question, wait for answer.
4. **Branch resolution** — Follow each answer to resolution before next question.
5. **Produce summary** — Shared-understanding summary + pending branches.
6. **Stop for confirmation** — Wait for user's explicit acceptance before proceeding.

## Output Contract

Return:
- Shared-understanding summary
- Pending/unresolved branches
- Explicit user confirmation required before proceeding

## References

- `grilling` skill — Bounded interview primitive (50-question budget, decision tree)