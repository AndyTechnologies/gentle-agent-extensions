---
name: product-quest
description: "Trigger: product quest, product decisions, domain decisions, product gaps, feature scope, domain modeling. Documents product/domain decisions in ODD tasks.md, detects gaps, and proposes resolution before task planning."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# Product Quest Skill

## Activation Contract

**Use this skill when:**
- Starting a new ODD task with product/domain uncertainty
- User request involves feature scope, user flows, domain rules, or business logic decisions
- Architecture Quest identifies gaps that are product/domain (not technical architecture)
- During development, new product questions arise that affect task planning
- Explicit request for product/domain decision documentation

**Do NOT use this skill for:**
- Purely technical architecture decisions (use architecture-quest)
- Implementation-only tasks with settled requirements
- UI/UX design decisions without domain impact (use gentle-design)
- Decisions already documented in existing specs/ADRs

## Hard Rules

| Rule | Description |
|------|-------------|
| **Pre-planning gate** | Runs BEFORE task planning; gaps must be resolved or explicitly accepted as assumptions |
| **Documents in ODD tasks.md** | Decisions go under `## Product Contract` in the ODD task document |
| **Orchestrator owns questions via grill-me** | Only orchestrator asks user, **using the `grill-me` skill** (bounded 50-question interview); Quest formulates questions |
| **Stable clause IDs** | Product clauses use `PC-01`, `PC-02`, etc. |
| **Gap detection is continuous** | Re-scan for gaps when requirements change or new info emerges |
| **No silent assumptions** | Every unresolved gap is either resolved, documented as assumption, or escalated |

## Knowledge Base

### Product Gap Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Scope ambiguity** | Unclear what is in/out of scope | "Does this include admin UI?" "Batch vs real-time?" |
| **Domain rule gaps** | Missing business logic/rules | "What happens on duplicate?" "Validation rules?" |
| **User flow gaps** | Unspecified user journeys | "Error recovery flow?" "Empty states?" |
| **Data ownership** | Unclear who owns/modifies data | "Who can delete?" "Audit trail?" |
| **Integration contracts** | External system expectations | "API shape?" "SLA?" "Error codes?" |
| **Non-functional requirements** | Missing quality attributes | "Performance?" "Accessibility?" "Compliance?" |
| **Edge cases** | Unhandled boundary conditions | "Concurrent edits?" "Network failure?" |
| **Migration/upgrade** | Transition from existing state | "Data migration?" "Backward compatibility?" |

### Decision Provenance Types

| Type | Description |
|------|-------------|
| `user_requirement` | Explicitly stated by user |
| `explicit_answer` | User answered a specific question |
| `existing_decision` | Documented in ADR, spec, or prior ODD task |
| `convention` | Project/product convention |
| `reversible_hypothesis` | Explicit assumption with rationale (must be validated) |
| `regulatory` | Compliance/legal requirement |

## Decision Gates

| Situation | Action |
|-----------|--------|
| No product gaps detected | Document "No product gaps identified"; proceed to planning |
| Blocking gap (prevents safe planning) | Formulate concrete question; **invoke `grill-me` skill** for bounded interview; STOP and wait for user |
| Assumable gap (reversible) | State explicit hypothesis with rationale; document as `reversible_hypothesis` |
| Non-blocking gap (convention) | Apply existing convention; document as `convention` |
| Multiple independent blocking gaps | Resolve one at a time via separate `grill-me` sessions or batch in minimal interactions |
| Requirements change mid-development | Re-run gap detection; update affected clauses; re-plan affected tasks |
| Gap depends on technical architecture | Coordinate with Architecture Quest; document cross-reference |

## Execution Steps

### Phase 1: Initial Gap Detection (at task start)

1. **Read user request verbatim** — extract functional outcome, examples, error messages
2. **Inspect existing context** — ODD task document (if exists), ADRs, specs, domain docs, prior tasks
3. **Identify explicit requirements** — stated functional requirements, constraints, examples
4. **Scan for gaps** against gap categories:
   - For each functional area mentioned, check: scope, rules, flows, data, integration, NFRs, edges, migration
5. **Classify each gap**: `blocking` | `assumable` | `non-blocking` | `deferred`

### Phase 2: Gap Resolution

6. **For each `blocking` gap**:
   - Formulate concrete question with alternatives and consequences
   - **Invoke `grill-me` skill** for bounded interview (max 50 questions, decision-tree discipline)
   - Record answer as `explicit_answer` with verbatim user response
   - Update clause state to `accepted`

7. **For each `assumable` gap**:
   - State explicit reversible hypothesis with rationale
   - Document validation criteria (how to verify later)
   - Mark clause as `assumed` with validation plan

8. **For each `non-blocking` gap**:
   - Apply existing convention or sensible default
   - Document as `convention` with reference

### Phase 3: Product Contract Creation

9. **Create `## Product Contract` section in ODD task document**:
   ```markdown
   ## Product Contract

   ### PC-01: [Short descriptive title]
   - **Context**: [Functional area and gap description]
   - **Decision**: [Accepted rule/flow/scope/behavior]
   - **Invariants**: [Properties that must hold for this decision]
   - **Constraints**: [Boundaries, limits, dependencies]
   - **Acceptance Criteria**: [Observable conditions for compliance]
   - **Expected Evidence**: [Tests, demos, specs, user flows]
   - **Provenance**: [user_requirement | explicit_answer | existing_decision | convention | reversible_hypothesis]
   - **State**: accepted | assumed | deferred
   - **Validation**: [How to verify this decision is correct] (for assumed)
   - **Cross-refs**: [AC-XX from Architecture Quest if related]
   ```

### Phase 4: Continuous Gap Monitoring

10. **During development**, when new information emerges:
    - Re-scan affected functional areas
    - Update Product Contract (add/replace clauses)
    - If new `blocking` gap found → stop and resolve
    - Communicate changes to orchestrator for task re-planning

### Phase 5: Pre-Planning Handoff

11. **Before task planning**, ensure:
    - All `blocking` gaps resolved or explicitly deferred with user acknowledgment
    - All `assumed` clauses have validation plans
    - Product Contract is complete for current scope
    - Cross-references to Architectural Contract are noted

## Output Contract

Upon completion, the orchestrator has:

- [ ] Product gaps identified and classified
- [ ] Blocking gaps resolved via user questions (or explicitly deferred)
- [ ] Assumable gaps documented as explicit reversible hypotheses
- [ ] Non-blocking gaps resolved via convention
- [ ] Product Contract created/updated in ODD task document with stable `PC-XX` IDs
- [ ] Each clause has: decision, invariants, constraints, acceptance criteria, evidence, provenance, state
- [ ] Validation plans for assumed clauses
- [ ] Cross-references to Architectural Contract clauses
- [ ] Ready for task planning with no unresolved blocking product decisions

## Product Contract Format

```markdown
## Product Contract

### PC-01: User authentication scope
- **Context**: User request mentions "login" but doesn't specify SSO, MFA, or session management
- **Decision**: Email/password with JWT sessions; SSO and MFA deferred to future task
- **Invariants**: Tokens expire in 24h; refresh token rotation; logout invalidates all sessions
- **Constraints**: No OAuth providers in this scope; password reset via email only
- **Acceptance Criteria**: Login returns access+refresh tokens; protected routes reject expired tokens; logout clears tokens
- **Expected Evidence**: Auth API tests; token expiry integration test; logout flow test
- **Provenance**: explicit_answer (user confirmed "basic auth for now")
- **State**: accepted
- **Validation**: N/A
- **Cross-refs**: AC-03 (auth boundary)

### PC-02: Duplicate handling (assumed)
- **Context**: API accepts creates but no spec for duplicate detection
- **Decision**: Return 409 on duplicate unique fields; client handles retry
- **Invariants**: Idempotency key supported for safe retries
- **Constraints**: Unique constraints at DB level; race condition handled by DB
- **Acceptance Criteria**: Duplicate create returns 409; idempotent retry succeeds
- **Expected Evidence**: Duplicate create test; concurrent create test with idempotency key
- **Provenance**: reversible_hypothesis (standard REST pattern; validate with user if issues arise)
- **State**: assumed
- **Validation**: Monitor production duplicate rates; user feedback on error clarity
- **Cross-refs**: AC-05 (data integrity)
```

## Coordination with Architecture Quest

| Scenario | Coordination |
|----------|--------------|
| Product gap has technical architecture impact | Architecture Quest creates `AC-XX`; Product Quest creates `PC-YY` with `Cross-refs` |
| Technical decision constrains product options | Architecture Quest runs first; Product Quest references accepted `AC-XX` |
| Product decision drives technical architecture | Product Quest runs first; Architecture Quest references accepted `PC-YY` |
| Both run concurrently | Orchestrator sequences: Product Quest for blocking product gaps first, then Architecture Quest |

## References

- Architecture Quest: `architecture-quest` skill
- ODD Workflow: `gentle-ai` skill (Task Size, Track, Delegation)
- `grill-me` skill — User-invoked bounded interview entry point
- `grilling` skill — Bounded interview primitive (50-question budget, decision tree)
- Keep a Changelog: https://keepachangelog.com/
- Semantic Versioning: https://semver.org/