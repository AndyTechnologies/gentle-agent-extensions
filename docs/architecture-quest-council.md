# Architecture Quest & Architecture Council

## Overview

This document explains the purpose, integration, and limitations of the `architecture-quest` skill and `architecture-council` agent for Gentle Pi.

## Purpose

**Architecture Quest** (`architecture-quest` skill) — Explores architectural needs for a task, identifies pending decisions, formulates questions for the user, and records a verifiable architectural contract.

**Architecture Council** (`architecture-council` agent) — Verifies that the implementation satisfies the accepted architectural contract from Quest, before the candidate proceeds to native RDD review.

## Relationship to ODD and Gentle Pi

- **ODD** remains the primary workflow: authorize → explore → resolve uncertainty → classify → track → implement → close
- **Quest** integrates into ODD's exploration and uncertainty resolution phases
- **Council** runs as a contractual verification step between implementation and RDD
- **RDD** retains full authority over risk evaluation, lens selection, consent, review, refutation, correction, and validation
- **Verify** (`gentle-ai-verify`) runs per native risk-tier rules; Council is an additional contractual check

## Architectural Contract

The contract lives in the ODD task document (`odd/tasks/<feature>.md`) under `## Architectural Contract`:

```markdown
## Architectural Contract

### AC-01: [Descriptive Title]
- **Context**: Functional problem and change scope
- **Decision**: Accepted architecture/boundaries/patterns
- **Invariants**: Properties implementation must maintain
- **Constraints**: Allowed/prohibited dependencies, data ownership, contracts
- **Acceptance Criteria**: Observable conditions for compliance
- **Expected Evidence**: Files, interfaces, tests, results, behavior
- **Provenance**: user requirement | explicit answer | existing decision | convention | reversible hypothesis
- **State**: accepted
```

Each clause has a stable ID (`AC-01`, `AC-02`, ...).

## Activation

Quest activates proportionally when a task may have material architectural consequences:
- New functionality crossing module boundaries
- Substantial data model or persistence changes
- New external integrations
- Changes to public contracts or domain models
- Auth/authorization/secrets
- Concurrency/async/distributed processing
- New extensibility needs
- Significant responsibility shifts
- Structural refactoring
- Hard-to-reverse decisions
- Explicit architectural review requests

**Do NOT activate** for local fixes, trivial changes, or when architecture is settled by conventions.

## Council Verification

Council verifies **only** the accepted Quest contract:
- Each clause's decision, invariants, constraints, acceptance criteria
- Evidence in code, tests, artifacts
- Consistency between contract, implementation, and Verify results

Council **does NOT**:
- Perform generic architecture review or code smell audit
- Repeat security/dependency review (covered by RDD's `review-risk` lens)
- Re-run Verify functional checks (unless tied to a contract clause)
- Impose patterns not in accepted decisions
- Invent requirements after seeing implementation
- Modify contract to make result appear correct
- Ask user questions (orchestrator owns all user interaction)
- Modify any files (read-only)

## Council Result States

| State | Meaning |
|-------|---------|
| `PASS` | Sufficient evidence of compliance |
| `FAIL` | Evidence of non-compliance |
| `UNVERIFIED` | Insufficient information to conclude |
| `NOT_APPLICABLE` | Clause no longer relevant (must refer to orchestrator) |

Aggregated result: `PASS` (all mandatory verified), `FAIL` (any mandatory failed), `INCOMPLETE` (missing evidence for mandatory).

## Execution Order

```
1. Architecture Quest → accepted contract (in ODD document)
2. Authorized implementation
3. gentle-ai-verify (when native rules require it)
4. Architecture Council → verifies contract
5. If PASS → native RDD per its configuration and candidate boundaries
```

**Critical:** Council runs BEFORE RDD for the candidate. If code changes after Council, re-run Council before RDD.

## Integration Boundaries

| Responsibility | Owner |
|----------------|-------|
| Risk evaluation | RDD (native) |
| Lens selection (`review-risk`, etc.) | RDD (native) |
| Consent requirements | RDD (native) |
| Candidate freeze, review, refutation, correction, validation | RDD (native) |
| Review authority, candidate identity, transaction evidence | RDD (native) |
| Delivery gate / kill switch | RDD (native) |
| Functional/structural verification per risk tier | `gentle-ai-verify` (native) |
| Architectural contract definition | Architecture Quest (orchestrator) |
| Contract verification | Architecture Council (this extension) |

## Limitations (Verified Against Installed Runtime)

1. **No native pre-RDD hook** — Council runs via orchestrator delegation (`subagent_run`). There is no runtime-enforced gate preventing RDD from running before Council. The orchestrator overlay documents the intended order but cannot enforce it at the runtime level.

2. **No candidate integrity verification** — Council operates on the current working tree state. There is no mechanism to verify the candidate hasn't changed since Council ran, other than orchestrator discipline. RDD's own candidate freeze mechanisms are separate.

3. **RDD configuration respected** — If RDD is disabled or its rules determine no review applies, Council does not force RDD. Council's PASS does not substitute for RDD approval.

4. **No automatic skill injection for Council** — The orchestrator must explicitly load the `architecture-quest` skill and transmit contract clauses to Council. Subagents do not automatically inherit orchestrator context.

5. **Overlay application timing** — The orchestrator overlay applies via `before_agent_start` event. If the orchestrator is already running, the overlay applies on next agent start. No runtime reload mechanism exists.

6. **Skill registry refresh required** — After adding the skill, run `/skill-registry:refresh` or restart Pi to update the registry. The extension's `session_start` handler auto-refreshes on startup.

7. **Agent discovery** — Custom agents are synced to `.pi/agents/` in the project. They are discovered by Gentle Pi's agent discovery (project scope takes precedence over global).

8. **Language/framework agnostic** — Quest does not impose Clean, Hexagonal, DDD, CQRS, microservices, or any specific pattern. The knowledge base is reference material; decisions are task-specific.

9. **No parallel review infrastructure** — Council does not create a second review authority, receipt system, or correction mechanism. It returns a verification result to the orchestrator.

10. **Tests verify structure, not runtime behavior** — The test suite validates file structure, parsing, and script behavior. End-to-end integration with Pi's runtime (agent delegation, overlay application, skill loading) requires manual verification in a live Pi session.

## Commands

```bash
# Install extension
./scripts/install.sh

# Sync agents, overlays, skills
./scripts/sync.sh

# Validate installation
./scripts/doctor.sh

# Check status in Pi
/gentle-extensions:status

# Refresh skill registry in Pi
/skill-registry:refresh
```

## Files Created

| File | Purpose |
|------|---------|
| `skills/architecture-quest/SKILL.md` | Quest skill with knowledge base, activation, investigation, contract format |
| `agents/architecture-council.md` | Council agent: read-only contractual verifier |
| `routing/architecture-council.md` | Delegation routing for Council |
| `overlays/orchestrator.overlay.md` | Orchestrator policy for Quest/Council integration |
| `docs/architecture-quest-council.md` | This documentation |

## Verification

Run tests:
```bash
node --test tests/gentle-extensions.test.ts
```

All 53 tests pass, including new skill structure and integration checks.
