---
target: orchestrator
priority: 100
mode: append
---

# Orchestrator Overlay: Architecture Quest, Product Quest, Council & Changelog Integration

This overlay integrates Architecture Quest, Product Quest, Architecture Council, and Changelog Generator into the Gentle Pi ODD workflow without modifying native RDD authority.

---

## Architecture Quest Activation

Activate Architecture Quest (via the `architecture-quest` skill) when a task **may have material architectural consequences**, including:

- New functionality crossing module boundaries
- Substantial changes to persistence or data models
- New external integrations
- Changes to public contracts or domain models
- Authentication, authorization, or secrets management
- Concurrency, async execution, or distributed processing
- New extensibility requirements
- Significant responsibility shifts between components
- Structural refactoring with architectural impact
- Decisions difficult to reverse
- Explicit architectural design or review requests

**Do NOT activate** for local modifications, trivial fixes, documentation-only changes without structural impact, or when architecture is already settled by existing conventions.

If relevance is unclear, perform a brief exploration first.

## Architecture Quest Investigation Process

When Quest activates, the orchestrator must:

1. **Understand goal and expected outcome** — read the user request verbatim
2. **Inspect existing code and decisions** — affected modules, contracts, dependencies, integration points; check existing ADRs, ODD docs, project conventions
3. **Determine explicit requirements and constraints** — stated requirements, non-functional constraints
4. **Identify and classify architectural gaps**:
   - **Blocking**: prevents safe choice between alternatives affecting design/data/security/contracts
   - **Relevant but assumable**: resolvable via explicit, reasonable, reversible hypothesis
   - **Non-blocking**: resolvable via existing conventions
5. **Resolve gaps proportionally**:
   - Blocking → formulate concrete question for **orchestrator to ask user** (only orchestrator asks users)
   - Assumable → state explicit reversible hypothesis with rationale
   - Non-blocking → apply existing conventions
6. **Compare relevant alternatives only** — functional fit, simplicity, cohesion/coupling, evolvability, regression risk, testability, security/isolation, performance/scaling, deployment/maintenance cost, reversibility, compatibility with existing architecture
7. **Produce Architectural Contract** in ODD task document under `## Architectural Contract` with stable clause IDs (`AC-01`, `AC-02`, ...), each containing:
   - Context, Decision, Invariants, Constraints, Acceptance Criteria, Expected Evidence, Provenance, State
8. **Deliver** contract to worker and Verify when relevant

## Architectural Contract in ODD Document

For substantial work (ODD task document exists), integrate the contract as a section:

```markdown
## Architectural Contract

### AC-01: [Title]
- **Context**: ...
- **Decision**: ...
- **Invariants**: ...
- **Constraints**: ...
- **Acceptance Criteria**: ...
- **Expected Evidence**: ...
- **Provenance**: user requirement | explicit answer | existing decision | convention | reversible hypothesis
- **State**: accepted
```

For small tasks, use a proportional contract without persistent documentation.

**Never** create a global contract registry, parallel task system, or ADR for every change. Use ADR only when a durable decision justifies independent record; link it to the ODD document.

---

## Product Quest Activation

Activate Product Quest (via the `product-quest` skill) when starting or revising an ODD task with **product/domain uncertainty**, including:

- Feature scope ambiguity (what is in/out)
- Missing domain rules or business logic
- Unspecified user flows or error recovery
- Unclear data ownership or permissions
- External integration contract gaps
- Missing non-functional requirements (performance, accessibility, compliance)
- Unhandled edge cases or boundary conditions
- Migration/upgrade strategy from existing state

**Do NOT activate** for purely technical architecture decisions (use Architecture Quest), implementation-only tasks with settled requirements, or UI/UX decisions without domain impact (use gentle-design).

## Product Quest Investigation Process

When Product Quest activates, the orchestrator must:

### Phase 1: Initial Gap Detection (at task start)

1. **Read user request verbatim** — extract functional outcome, examples, error messages
2. **Inspect existing context** — ODD task document (if exists), ADRs, specs, domain docs, prior tasks
3. **Identify explicit requirements** — stated functional requirements, constraints, examples
4. **Scan for gaps** against gap categories:
   - Scope ambiguity, Domain rule gaps, User flow gaps, Data ownership, Integration contracts, Non-functional requirements, Edge cases, Migration/upgrade
5. **Classify each gap**: `blocking` | `assumable` | `non-blocking` | `deferred`

### Phase 2: Gap Resolution

6. **For each `blocking` gap**:
   - Formulate concrete question with alternatives and consequences
   - Present to orchestrator to ask user
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

---

## Coordination: Product Quest ↔ Architecture Quest

| Scenario | Coordination |
|----------|--------------|
| Product gap has technical architecture impact | Architecture Quest creates `AC-XX`; Product Quest creates `PC-YY` with `Cross-refs` |
| Technical decision constrains product options | Architecture Quest runs first; Product Quest references accepted `AC-XX` |
| Product decision drives technical architecture | Product Quest runs first; Architecture Quest references accepted `PC-YY` |
| Both relevant concurrently | Orchestrator sequences: Product Quest for blocking product gaps first, then Architecture Quest |

---

## Architecture Council Execution

When an accepted architectural contract exists for the current task:

1. After implementation is complete for the relevant unit
2. After `gentle-ai-verify` runs (when native rules require it)
3. **Before** invoking the native RDD review for the candidate

Delegate to `architecture-council` via `subagent_run` with:
- The accepted architectural contract (or reference to ODD document `## Architectural Contract`)
- Specific clause IDs to verify
- Implementation scope (diff summary or affected files)
- Summary of Verify results
- Path to ODD task document and relevant ADRs
- Tests/evidence related to each clause

## Council Result Handling

| Council Result | Action |
|----------------|--------|
| `PASS` | Continue to native RDD per its configuration and candidate boundaries |
| `FAIL` | Identify failed clauses; if correctable within authorized scope, return to worker with exact clauses and evidence; after correction, re-run relevant Verify, then re-run Council |
| `INCOMPLETE` | Obtain missing evidence or register concrete limitation; do NOT treat as PASS |

**Critical:** Council is read-only. It does not modify code, contract, or decisions. It does not ask the user. It does not duplicate Verify or `review-risk`.

---

## Changelog Generator Activation

Activate Changelog Generator (via the `changelog-generator` skill) **after ODD implementation is complete AND RDD review has passed (when RDD is enabled)**.

Trigger conditions:
- All ODD tasks for the feature are marked `done`
- RDD review result is `PASS` or RDD is disabled/not applicable
- Feature branch is ready for merge/release

**Do NOT activate** mid-implementation, before RDD completion (when RDD enabled), or for trivial changes with no user-visible impact.

## Changelog Generation Process

When Changelog Generator activates, the orchestrator must:

1. **Determine base branch** — default `main` or `master` (whichever exists); allow user override
2. **Compute git diff** — `git diff <base>...HEAD` with stat and full diff
3. **Analyze each change** — categorize: breaking | feature | fix | internal | docs | test | build
4. **Aggregate substantiality** — files, lines, API changes, config changes, data changes
5. **Generate changelog content** — Keep a Changelog format: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
6. **Propose version bumps (minimum 2)** — following SemVer 2.0.0:
   - Primary recommendation with rationale
   - At least one alternative with rationale
   - Explain what would be needed for each level
7. **Write/update CHANGELOG.md** — prepend new version section at top, preserve history
8. **Present to user** — show changelog section, version proposals, substantiality analysis; ask for confirmation

## Version Proposal Rules (SemVer)

| Change Type | SemVer Bump | Examples |
|-------------|-------------|----------|
| **Breaking** | MAJOR (X.0.0) | Removed public API, changed contract signatures, removed config options, DB schema breaking migrations, CLI flag removal/rename |
| **Feature** | MINOR (0.Y.0) | New command, new optional flag, new API endpoint, new agent/skill, new overlay, new MCP server, new exported function |
| **Fix** | PATCH (0.0.Z) | Bug fix, typo, performance improvement, test fix, docs correction, dependency patch update |
| **Internal** | NONE (or PATCH if user wants) | Refactor without behavior change, test-only changes, build/CI changes, formatting |

**Always propose at least 2 version options** (e.g., MINOR + PATCH, or MAJOR + MINOR).

---

## RDD Integration Boundaries

The following remain **exclusively** under native RDD authority:

- Risk evaluation of the change
- Lens selection (`review-risk`, `review-reliability`, `review-resilience`, `review-readability`)
- Consent requirements
- Candidate freeze, review, refutation, bounded correction, validation
- Review authority, candidate identity, transaction evidence
- Delivery gate / kill switch

**Architecture Council, Product Quest, and Changelog Generator do not:**
- Decide if RDD activates
- Select lenses
- Replace RDD results
- Force RDD when its configuration/rules determine it doesn't apply
- Produce a competing approval

If RDD is explicitly disabled, respect that decision. Do not attempt to activate RDD or show consent.

---

## Verification Rule Compliance

The Verification rule (orchestrator-verification.md) remains unchanged:

- Only a named high-risk item (assess `escalate`) → independent `gentle-ai-verify`
- Architecture Council is a **contractual verification**, not a risk-tier verifier
- Product Quest is a **pre-planning gate**, not a verifier
- Changelog Generator is **post-completion documentation**, not a verifier
- Council runs in addition to (not instead of) the tier's verification
- Tier's verifier runs before RDD review; Council runs before RDD review
- A native high/unknown/assess-failed tier informs only; writer self-verification stands unless `escalate` names a Task Size high-risk item

---

## Delegation Triggers Unchanged

The seven delegation triggers (Ask, Evidence-budget, Verification, Track, Writer, Incident, Context backstop) fire per their existing conditions. This overlay adds no new triggers.

---

## Skill Loading

When any quest is relevant, ensure the corresponding skill is loaded:
- `architecture-quest` for architectural decisions
- `product-quest` for product/domain decisions
- `changelog-generator` for post-ODD/RDD changelog and version proposals
- `grill-me` / `grilling` when any quest has blocking gaps requiring user questions

The skill registry protocol applies: parent resolves skill paths once per session; subagents read injected paths.

## Skill Wiring: Quest → grill-me/grilling

**Mandatory wiring** — when Architecture Quest or Product Quest identifies a `blocking` gap:

1. **Orchestrator loads `grill-me` skill** (which loads `grilling` primitive)
2. **Orchestrator invokes `grill-me`** with the formulated question(s) from the Quest
3. **`grilling` primitive runs** — bounded 50-question interview, decision-tree discipline, one question at a time
4. **User answers** → Quest records as `explicit_answer` provenance
5. **Quest updates clause state** to `accepted` and continues

**Never** have the model "infer" it should load grill-me. The overlay explicitly wires:
- Quest detects blocking gap → Quest formulates question → Orchestrator loads grill-me → Orchestrator runs grill-me → User answers → Quest records answer

This is a deterministic handoff, not a model decision.

---

## Context Transmission to Subagents

When delegating to worker, Verify, Council, or any quest, explicitly transmit:
- Relevant architectural contract clauses (`AC-XX`)
- Relevant product contract clauses (`PC-YY`)
- Acceptance criteria and expected evidence per clause
- Provenance of decisions

Subagents do not automatically inherit full orchestrator context.

---

## Contract Evolution

If requirements change or a decision is replaced:
1. Update affected clauses in the ODD document (both Architectural and Product Contracts)
2. Mark replaced decisions explicitly (do not rewrite history)
3. Re-run affected verification (Verify and Council)
4. Update ADR if one exists and is linked
5. Re-run Changelog Generator if version proposal may change

---

## Prohibited Behaviors

- ❌ Forcing full Quest for trivial changes
- ❌ Subagents asking user questions
- ❌ Global contract registry
- ❌ Council duplicating Verify or `review-risk`
- ❌ Council modifying RDD contract, candidate, or authority
- ❌ Forcing RDD when native config says no
- ❌ Treating Council PASS as RDD approval or delivery authorization
- ❌ Generating changelog before RDD completion (when RDD enabled)
- ❌ Auto-committing changelog or version bump
- ❌ Proposing only one version option