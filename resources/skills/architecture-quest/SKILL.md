---
name: architecture-quest
description: "Trigger: architecture quest, architectural exploration, design decision, contract architecturale. Explores architectural needs, identifies gaps, formulates user questions, and records a verifiable architectural contract for ODD tasks."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# Architecture Quest Skill

## Activation Contract

**Use this skill when:**
- A task may have material architectural consequences (new feature crossing module boundaries, substantial data model changes, new external integrations, changes to public contracts or domain models, authentication/authorization/secrets, concurrency/async/distributed processing, new extensibility needs, significant responsibility shifts, structural refactoring, hard-to-reverse decisions, explicit architectural design/review request)
- An architectural decision is pending that cannot be deduced from existing conventions or requirements

**Do NOT use this skill for:**
- Local modifications, trivial fixes, documentation-only changes without structural impact
- Tasks where the architecture is already settled by existing conventions
- One-off exploratory questions that don't require a formal contract

## Knowledge Base

### Verified References (consult when relevant)

| Source | URL | Purpose |
|--------|-----|---------|
| Refactoring Guru — Principles & Patterns | https://refactoring.guru/ | Pattern catalog, principles |
| SOLID Design Principles | https://principles.design/examples/solid-design-principles | Design principles |
| Clean Architecture — R. Martin | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html | Layered/clean architecture |
| Hexagonal Architecture — Cockburn | https://alistair.cockburn.us/hexagonal-architecture | Ports and adapters |
| Azure Architecture Styles | https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/ | Deployment/system styles |
| Microservices — Fowler | https://www.martinfowler.com/articles/microservices.html | Microservices trade-offs |
| DDD — Fowler | https://martinfowler.com/bliki/DomainDrivenDesign.html | Domain modeling |
| Bounded Context — Fowler | https://martinfowler.com/bliki/BoundedContext.html | Context boundaries |
| MVC — MDN | https://developer.mozilla.org/en-US/docs/Glossary/MVC | Presentation patterns |
| Event Sourcing — Azure | https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing/ | Event-driven patterns |

**Before using a reference, verify the link works and content matches. If 404/moved/irrelevant, find alternative and update docs.**

### Design Degradation Symptoms

| Symptom | Meaning | Possible Causes | Countermeasures |
|---------|---------|-----------------|-----------------|
| **Rigidity** | Small changes require multi-component edits | Unnecessary coupling | Dependency inversion, interfaces |
| **Fragility** | Changes break unrelated components | Hidden dependencies | Explicit contracts, isolation |
| **Immobility** | Components hard to extract/reuse | Global state, infra coupling | Encapsulation, dependency injection |
| **Viscosity** | Quick patch easier than correct design | Complexity, friction | Simplify, reduce ceremony |
| **Unnecessary Complexity** | Abstractions without proven need | Premature generalization | YAGNI, KISS |
| **Unnecessary Repetition** | Shared knowledge duplicated | Missing abstraction | DRY for shared knowledge only |
| **Opacity** | Responsibilities/invariants unclear | Implicit contracts | Explicit contracts, documentation |

### Design Principles (apply when relevant)

- Separation of concerns
- High cohesion, low coupling
- SOLID
- Encapsulation, information hiding
- Dependency inversion
- Composition over inheritance (when beneficial)
- KISS, YAGNI
- DRY for truly shared knowledge
- Design for change and reversibility
- Explicit contracts and invariants
- Proportionate tests for risk
- Incremental migration, compatibility
- Observability, resilience, recovery (when pertinent)
- Security by design, trust boundaries
- Maintainability, accessibility (when requirements)

### System & Deployment Architectures (recognize and compare)

- Simple app / traditional monolith
- Modular monolith
- Layered / N-tier
- Client-server
- SOA / service-oriented
- Microservices
- Event-driven
- Web, workers, queues
- Serverless
- Microkernel / plugin
- Pipes and Filters
- Distributed, batch processing

**Evaluate:** deployment boundaries, communication, consistency, scaling, fault isolation, operational cost, evolution difficulty. **Prefer modular monolith over microservices unless requirements justify the complexity.**

### Internal Architectures & Boundaries (recognize and compare)

- Layered Architecture
- Clean Architecture
- Hexagonal / Ports and Adapters
- Onion Architecture
- Domain-Driven Design
- Bounded Contexts
- Vertical Slice Architecture
- Modular capability-oriented
- Plugin-oriented
- Dependency Injection / Inversion

**Distinguish:** technical layers vs. capabilities vs. domain boundaries. Clean/Hexagonal/Onion are not identical; adopting one doesn't imply all variants.

### Data Flow & Consistency (when relevant)

- CQRS
- Event Sourcing
- Event-driven processing
- Materialized Views
- Outbox Pattern
- Saga Pattern
- Idempotency, at-least-once
- Strong vs. eventual consistency

**Don't introduce CQRS/Event Sourcing without requirements justifying their costs.**

### Design Patterns (recognize when relevant)

Creational: Factory Method, Abstract Factory, Builder  
Structural: Adapter, Facade, Decorator, Proxy  
Behavioral: Strategy, State, Command, Template Method, Observer, Mediator, Chain of Responsibility  
Structural: Composite, Bridge, Iterator  
Architectural: Repository, Unit of Work, Anti-Corruption Layer, Circuit Breaker, Retry with backoff, Bulkhead

**Not every problem needs a pattern. Simplest solution that satisfies requirements is best.**

## Hard Rules

| Rule | Description |
|------|-------------|
| **No mandatory full quest** | Quest activates proportionally to uncertainty and consequence. No full investigation for local/trivial changes. |
| **Orchestrator owns user questions** | Only the orchestrator may ask the user. Subagents (including Council) never ask directly. |
| **Contract in ODD document** | Architectural contract lives in the ODD task document (`odd/tasks/<feature>.md`) under `## Architectural Contract`. No global contract registry. |
| **Stable clause IDs** | Contract clauses use stable identifiers: `AC-01`, `AC-02`, etc. |
| **Verifiable criteria** | Every clause must have observable acceptance criteria and expected evidence. |
| **Provenance required** | Each clause records provenance: user requirement, explicit answer, existing decision, convention, or reversible hypothesis. |
| **No premature acceptance** | Don't mark a clause `accepted` if it depends on a pending user answer. |
| **No duplication of RDD lenses** | Quest does not recreate `review-risk` or other RDD lenses. Council verifies the Quest contract only. |
| **Language/framework agnostic** | Quest does not impose a specific architecture on all projects. |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Task has no architectural impact | Skip Quest; proceed inline |
| Uncertainty exists but consequence low | Classify as `assumable` or `non-blocking`; use reversible hypothesis |
| Uncertainty is blocking (changes design/data/security/contracts) | Formulate concrete question; ask user; stop and wait |
| Multiple independent blocking decisions | Resolve one at a time or in minimal interactions |
| Decision can be deduced from requirements + conventions | Document as accepted with provenance `convention` or `existing decision` |
| Requirements change after contract accepted | Update affected clauses; mark replaced decisions; don't rewrite history |

## Execution Steps

1. **Understand goal and scope**
   - Read the user request verbatim.
   - Identify functional outcome and expected result.
   - Determine affected modules, contracts, dependencies, integration points.

2. **Inspect existing code and decisions**
   - Read relevant source files, interfaces, configuration.
   - Check existing ADRs, ODD docs, architectural conventions in the project.
   - Note current patterns, layer boundaries, data ownership.

3. **Identify explicit requirements and constraints**
   - Extract stated requirements from the request.
   - Identify non-functional constraints (performance, security, compliance, compatibility).

4. **Classify architectural gaps**
   - For each uncertainty that could materially change the solution, classify:
     - **Blocking**: prevents safe choice between alternatives affecting design/data/security/contracts
     - **Relevant but assumable**: resolvable via explicit, reasonable, reversible hypothesis
     - **Non-blocking**: resolvable via existing conventions

5. **Resolve gaps proportionally**
   - For `blocking` gaps: formulate concrete question(s) for the orchestrator to ask the user. Explain decision, relevant alternatives, and main consequences.
   - For `assumable` gaps: state explicit reversible hypothesis with rationale.
   - For `non-blocking` gaps: apply existing conventions.

6. **Compare relevant alternatives**
   - Compare only alternatives that could satisfy requirements.
   - Consider: functional fit, simplicity, cohesion/coupling, evolvability, regression risk, testability, security/isolation, performance/scaling, deployment/maintenance cost, reversibility, compatibility with existing architecture.
   - No invented metrics or false-precision scores. Explain trade-offs; select least complex solution satisfying requirements.

7. **Produce Architectural Contract**
   - Create/Update `## Architectural Contract` in the ODD task document.
   - For each clause, include:
     - **ID**: `AC-XX`
     - **Context**: functional problem and change scope
     - **Accepted decision**: architecture, boundaries, patterns, strategies selected
     - **Invariants**: properties implementation must maintain
     - **Constraints**: allowed/prohibited dependencies, data ownership, contracts, boundaries
     - **Acceptance criteria**: observable conditions for compliance
     - **Expected evidence**: files, interfaces, tests, results, behavior needed for verification
     - **Provenance**: user requirement, explicit answer, existing decision, convention, reversible hypothesis
     - **State**: `proposed` | `accepted` | `rejected` | `replaced`

8. **Deliver to implementation**
   - Ensure orchestrator has: understood goal/scope, boundaries/components, resolved gaps, Q&A, accepted contract, verifiable criteria, pending assumptions/risks.
   - Contract clauses transmitted to worker and Verify when relevant.

## Architectural Contract Format

```markdown
## Architectural Contract

### AC-01: [Short descriptive title]
- **Context**: [Functional problem and scope of change]
- **Decision**: [Accepted architecture/boundaries/patterns]
- **Invariants**: [Properties that must hold]
- **Constraints**: [Allowed/prohibited dependencies, data ownership, contracts]
- **Acceptance Criteria**: [Observable conditions for compliance]
- **Expected Evidence**: [Files, interfaces, tests, results, behavior]
- **Provenance**: [user requirement | explicit answer | existing decision | convention | reversible hypothesis]
- **State**: accepted
```

## Output Contract

Upon completion, the orchestrator has:

- [ ] Goal and scope understood
- [ ] Boundaries and affected components identified
- [ ] Relevant gaps resolved or classified
- [ ] Questions asked and answered (if any)
- [ ] Architectural contract accepted with stable clause IDs
- [ ] Verifiable acceptance criteria per clause
- [ ] Assumptions and risks documented
- [ ] Contract integrated into ODD task document (when substantial)
- [ ] Clauses transmitted to worker and Verify when relevant

## References

- `docs/conventions.md` — Project conventions for skills, agents, overlays
- `orchestrator.md` — ODD workflow, Task Size, Delegation Rules, Verification rule
- `orchestrator-verification.md` — Verification rule, tier table, assess/escalate
- `rdd-defect-workflow/SKILL.md` — RDD integration, candidate freeze, review authority
- `gentle-ai/SKILL.md` — Harness discipline, Work Routing, Review Lens Selection
- External references listed in Knowledge Base (verified at load time)