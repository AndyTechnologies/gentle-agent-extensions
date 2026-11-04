# Skills Reference

## Overview

gentle-agent-extensions bundles **13 skills** covering architectural exploration, product decisions, GitHub automation, UI design, grilling interviews, test hygiene, git worktrees, and more.

## Skill Categories

### Architecture & Design
| Skill | Trigger | Purpose |
|-------|---------|---------|
| `architecture-quest` | architecture quest, architectural exploration, design decision | Explores architectural needs, identifies gaps, produces verifiable contracts; blocking gaps → `grill-me` |
| `product-quest` | product quest, product decisions, domain decisions, feature scope | Product/domain decisions in ODD; blocking gaps → `grill-me` |
| `changelog-generator` | changelog, release notes, semver, version bump | Post-ODD/RDD changelog + SemVer proposals (min 2 options) |

### UI/UX
| Skill | Trigger | Purpose |
|-------|---------|---------|
| `gentle-ui` | gentle-ai, Gentle-AI, diseño gentle, UI web, desktop, TUI | Gentle-AI design system: zinc/magenta (web), Rose Pine (TUI) |
| `ui-design` | UI/UX design, components, design system, accessibility | UI decisions checklist; records in design artifact |
| `ui-ux-principles` | UI/UX principles, Nielsen, WCAG, HCD, usability | HCD, heuristics, WCAG 2.2, metrics, AI agent evaluation |

### Automation & Operations
| Skill | Trigger | Purpose |
|-------|---------|---------|
| `github-automation` | GitHub automation, repos, issues, PRs, Actions, code search | `gh` CLI + `git` via bash (no MCP, no tokens) |
| `red-suite-hygiene` | RED checks, test failures, tmpfs full, orphan processes | Clean test env before diagnosing failures (generic) |
| `using-git-worktrees` | git worktrees, isolated workspace | Isolated workspace via native tools or git worktree fallback |

### Interview & Collaboration
| Skill | Trigger | Purpose |
|-------|---------|---------|
| `grilling` | grill, stress-test thinking | Bounded interview primitive (50 questions, decision tree) |
| `grill-me` | /grill-me, grill me | User-invoked entry point for grilling sessions |

### Quality & Maintenance
| Skill | Trigger | Purpose |
|-------|---------|---------|
| `skill-quality-validator` | skill validation, skill lint, skill quality | Validates skill structure, frontmatter, refs, deps, links, conventions |
| `gentle-agent-extension` | extend gentle-ai, add agent, add overlay | Package maintainer guide |

---

## Skill Details

### `architecture-quest`
**Trigger:** `architecture quest`, `architectural exploration`, `design decision`

**Purpose:** Explores architectural needs, identifies gaps, produces verifiable contracts; blocking gaps → internal `quest-interview` (via `grilling` primitive).

**Key Features:**
- Gap classification: Blocking / Assumable / Non-blocking
- Architectural Contract (AC-XX) with invariants, constraints, acceptance criteria
- Cross-references with Product Quest (PC-XX)
- Internal `quest-interview` for blocking gaps (bounded 50-question interview)

**References:** Architecture Quest skill, ODD Workflow, RDD integration

---

### `product-quest`
**Trigger:** `product quest`, `product decisions`, `domain decisions`, `feature scope`

**Purpose:** Documents product/domain decisions in ODD tasks, detects gaps, proposes resolution before task planning.

**Key Features:**
- Gap categories: Scope, Domain rules, User flows, Data ownership, Integration, NFRs, Edge cases, Migration
- Product Contract (PC-XX) with validation plans for assumed clauses
- Cross-references to Architectural Contract (AC-XX)
- Internal `quest-interview` for blocking gaps

**Gap Categories:**
| Category | Examples |
|----------|----------|
| Scope ambiguity | "Does this include admin UI?" |
| Domain rule gaps | "What happens on duplicate?" |
| User flow gaps | "Error recovery flow?" |
| Data ownership | "Who can delete?" |
| Integration contracts | "API shape? SLA?" |
| Non-functional reqs | "Performance? Accessibility?" |
| Edge cases | "Concurrent edits?" |
| Migration/upgrade | "Data migration?" |

---

### `changelog-generator`
**Trigger:** `changelog`, `change log`, `release notes`, `semver`, `version bump`

**Purpose:** Generates CHANGELOG.md from git diff after ODD/RDD completion; proposes SemVer bumps (min 2 options).

**Features:**
- Post-ODD/RDD only (blocks mid-implementation)
- Keep a Changelog format (Added, Changed, Deprecated, Removed, Fixed, Security)
- Minimum 2 SemVer version proposals with rationale
- Detects version files (package.json, Cargo.toml, pyproject.toml, go.mod, etc.)
- Reminds to bump version before commit/tag
- No auto-commit (user decides)

**SemVer Decision Matrix:**
| Change Type | Bump | Examples |
|-------------|------|----------|
| Breaking | MAJOR | Removed API, changed signatures, removed config |
| Feature | MINOR | New command, optional flag, new endpoint |
| Fix | PATCH | Bug fix, typo, performance, test fix |
| Internal | NONE/PATCH | Refactor, test-only, build/CI, formatting |

---

### `gentle-ui`
**Trigger:** `gentle-ai`, `Gentle-AI`, `diseño gentle`, `estilo gentle`, `interfaz visual`, `UI web`, `desktop`, `TUI`, `terminal`, `tema rose pine`

**Purpose:** Gentle-AI design system for web, desktop, and TUI.

**Design Tokens:**
| Category | Web | TUI |
|----------|-----|-----|
| Background | `#09090b` | `#191724` |
| Surface/Card | `#111113` | - |
| Code | `#18181c` | - |
| Border | `#ffffff12` (hover: `#ea188959`) | - |
| Text Primary | `#fafafa` | `#e0def4` |
| Text Secondary | `#a1a1aa` | `#908caa` |
| Accent | `#ea1889` (hover: `#ff6db0`) | `#c4a7e7` |
| Success | - | `#9ccfd8` |
| Error | - | `#eb6f92` |
| Warning | - | `#f1ca93` |

**Typography:** Inter, system-ui, -apple-system, sans-serif. Mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas.

**Non-negotiables:**
- Single chromatic accent
- Borders `#ffffff12`, never hard lines
- 8px controls, 16px cards
- Spacing in 4px multiples
- Dark-first (light mode = inverted grays)

---

### `github-automation`
**Trigger:** GitHub automation, repos, issues, PRs, Actions, code search

**Purpose:** GitHub operations via `gh` CLI + `git` via bash (no MCP, no tokens).

**Operations:**
- **Identity:** `gh api user`
- **Repos:** `gh repo view`, `gh repo list`
- **Search:** `gh api /search/code`, `gh api /search/repositories`
- **Issues:** `gh issue list`, `gh issue view`, `gh issue comment`, `gh issue edit`
- **Branches:** `gh api repos/.../branches`, git local + push
- **PRs:** `gh pr list/view/diff/checks`, `gh pr review`, `gh pr merge`
- **Actions:** `gh run list/view/rerun`, `gh run view --log`
- **Content:** `gh api repos/.../contents/<path>`

**Hard Rules:**
- No tokens in skill (gh manages auth)
- Status before review (`gh pr checks` first)
- Verify merged before delete
- Root cause triage (not one-by-one)

---

### `gentle-ui`
**Trigger:** `gentle-ai`, `Gentle-AI`, `diseño gentle`, `estilo gentle`, `interfaz visual`, `UI web`, `desktop`, `TUI`, `terminal`, `tema rose pine`

**Purpose:** Gentle-AI design system for web, desktop, and TUI.

**Web:**
- Background: `#09090b`, Cards: `#111113`, Code: `#18181c`
- Border: `#ffffff12` (hover: `#ea188959`)
- Text: `#fafafa` / `#a1a1aa` / `#52525b`
- Accent: `#ea1889` (hover: `#ff6db0`, subtle: `#ea188926`)
- Font: Inter, system-ui, -apple-system, sans-serif
- Code: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas

**TUI (Rose Pine):**
- Base: `#191724`, Text: `#e0def4`, Muted: `#908caa`
- Accent/Selection: `#c4a7e7`, Headings: `#ebbcba`
- Success: `#9ccfd8`, Error: `#eb6f92`, Warning: `#f1ca93`
- Avoid: `#6e6a86`, `#31748f` for normal text (contrast < 4.5:1)

**Rules:**
- Single chromatic accent
- Borders `#ffffff12`, never hard lines
- Rounded: 8px controls, 16px cards
- Spacing: 4px multiples
- Dark-first (light = inverted grays)

---

### `github-automation`
**Trigger:** `GitHub automation`, `repositories`, `issues`, `branches`, `commits`, `pull request review`, `merge`, `status`, `Actions workflows`, `code search`

**Purpose:** GitHub operations via `gh` CLI + `git` via bash (no MCP, no tokens).

**Prerequisites:**
- `gh` CLI ≥ 2.x, authenticated (`gh auth login`)
- `git` on PATH

**Commands by Category:**

**Identity/Profile:**
```bash
gh api user                    # current user + scopes
gh api user --jq '.login'      # just username
```

**Repositories:**
```bash
gh repo view <owner>/<repo> --json name,defaultBranch,visibility,topics
gh repo list <owner> --json name,defaultBranch,visibility --limit 100
```

**Search:**
```bash
gh api /search/code?q=repo:owner/name+<query> --jq '.items[] | {path, repository, html_url}'
gh api /search/repositories?q=<query> --jq '.items[] | {full_name, description, stargazers_count}'
gh api /search/issues?q=repo:owner/name+<query> --jq '.items[] | {number, title, state, labels, assignees}'
```

**Issues:**
```bash
gh issue list --repo <owner>/<repo> --state open --json number,title,labels,assignees,updatedAt --limit 50
gh issue view <number> --repo <owner>/<repo> --json number,title,body,labels,assignees,comments
gh issue comment <number> --repo <owner>/<repo> --body "…"
gh issue edit <number> --repo <owner>/<repo> --add-label "bug"
gh issue edit <number> --repo <owner>/<repo> --add-assignee "@me"
```

**Branches:**
```bash
gh api repos/<owner>/<repo>/branches --jq '.[].name'
git fetch origin <default-branch>
git checkout -b <new-branch> origin/<default-branch>
git push -u origin <new-branch>
gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>
```

**PRs:**
```bash
gh pr list --repo <owner>/<repo> --state open --json number,title,headRefName,baseRefName,author,reviews,statusCheckRollup --limit 30
gh pr view <number> --repo <owner>/<repo> --json number,title,body,headRefName,baseRefName,author,reviews,statusCheckRollup,files,additions,deletions
gh pr diff <number> --repo <owner>/<repo>
gh pr checks <number> --repo <owner>/<repo>
gh pr review <number> --repo <owner>/<repo> --approve --body "LGTM"
gh pr review <number> --repo <owner>/<repo> --request-changes --body "Needs fixes"
gh pr merge <number> --repo <owner>/<repo> --squash --delete-branch
```

**Actions:**
```bash
gh run list --repo <owner>/<repo> --limit 20 --json databaseId,conclusion,status,headBranch,workflowName,createdAt
gh run view <run-id> --repo <owner>/<repo> --log
gh run rerun <run-id> --repo <owner>/<repo>
gh run rerun <run-id> --repo <owner>/<repo> --failed
```

**Files:**
```bash
gh api repos/<owner>/<repo>/contents/<path> --jq '.content' | base64 -d
```

---

### `grilling`
**Trigger:** `grill`, `stress-test thinking`

**Purpose:** Bounded interview primitive (50-question budget, decision-tree discipline, one question at a time).

**Hard Rules:**
- Hard question budget = 50
- One question at a time
- Plan before you ask (decision tree)
- User-invoked only (never auto)
- Facts = your job (dispatch sub-agents)
- No stack/framework unless user confirms

**Process:**
1. Design question path (impact × uncertainty)
2. Ask ONE question, wait for answer
3. Follow branch to resolution
4. Recompute priorities
5. Stop at 50 questions
6. Consolidate + list pending branches

---

### `grill-me`
**Trigger:** `/grill-me`, `grill me`

**Purpose:** User-invoked entry point for grilling sessions.

**Rules:**
- User-invoked only (disable-model-invocation: true)
- Delegates to `grilling` skill
- One-shot bounded session
- Never auto-invoked by model

---

### `red-suite-hygiene`
**Trigger:** `RED checks`, `test suite failures`, `write error`, `Disk quota exceeded`, `tmpfs full`, `orphaned processes`, `fake API`

**Purpose:** Clean test-environment debris before diagnosing failures.

**Execution Steps:**
1. Preflight: `df -h /tmp` (if >70% → sweep)
2. Sweep: `rm -rf /tmp/test-* /tmp/suite-* /tmp/sandbox-* /tmp/red-* /tmp/opencode-*`
3. Orphans: `pgrep -af 'fake_api|mock_server|chromedriver|playwright|vitest|jest'` → kill confirmed PIDs
4. Ports: `ss -tlnp \| grep -E ':3000\|:3001\|:4000\|:8000\|:8080\|:9000'`
5. Clean re-run: `timeout 300 <test-command> > /tmp/test_clean.log 2>&1`
6. Classify: grep log for env errors near each FAIL

**Hard Rules:**
- NEVER diagnose while environment degraded
- NEVER `pkill -f` with broad patterns
- Only FAIL reproduced after sweep = real defect

---

### `ui-design`
**Trigger:** `UI/UX design`, `interface`, `components`, `design system`, `accessibility`

**Purpose:** UI/UX decisions checklist; records in design artifact.

**Priority Checklist:**
1. Accessibility: contrast ≥ 4.5:1, focus rings, aria labels, keyboard nav
2. Touch: targets ≥ 44×44px, 8px+ spacing, loading feedback
3. Performance: lazy images (WebP/AVIF), CLS < 0.1
4. Consistency: patterns, SVG icons, no emoji
5. Layout: mobile-first, no horizontal scroll, no fixed px
6. Typography: base 16px, line-height 1.5, semantic tokens, body ≥ 12px
7. Motion: context-aware, respect reduced-motion, no width/height animation
8. Forms: visible labels, errors near field, helper text, progressive disclosure
9. Navigation: predictable back, bottom nav ≤ 5, deep linking
10. Charts: legends, tooltips, never color-only meaning

**Gentle-AI Style:** Uses `gentle-ui` tokens.

---

### `ui-ux-principles`
**Trigger:** `UI/UX principles`, `heurísticas`, `Nielsen`, `usability`, `accesibilidad`, `accessibility`, `WCAG`, `POUR`, `ISO 9241`, `HCD`, `user research`, `SUS`

**Purpose:** Apply HCD, Nielsen heuristics, metrics, WCAG 2.2 when designing/evaluating interfaces.

**Hard Rules:**
- HCD before pixels (ISO 9241-210)
- Heuristics = filter, not proof (3-5 evaluators)
- Think-aloud = ground truth (5 users = 77-85% problems)
- Measure: task success, time-on-task, error rate, SUS, SEQ
- WCAG 2.2 AA by default (POUR)
- Automated scans catch 30-50% only → manual eval mandatory
- AI evals add: trust calibration, explainability, agent reliability

**Evaluation Methods:**
| Method | When | Participants |
|--------|------|--------------|
| Heuristic inspection | Early design, quick feedback | 3-5 evaluators |
| Think-aloud | Need proof of real usability | ≥5 users |
| SUS benchmark | Compare versions | ≥20 for reliable score |
| WCAG 2.2 AA | Legal/compliance required | Manual + automated |

---

### `using-git-worktrees`
**Trigger:** `git worktrees`, `isolated workspace`

**Purpose:** Isolated workspace via native tools or git worktree fallback.

**Steps:**
1. **Detect existing isolation** (GIT_DIR vs GIT_COMMON_DIR, submodule guard)
2. **Native tools first** (EnterWorktree, WorktreeCreate, /worktree, --worktree)
3. **Git fallback:** `.worktrees/` preferred, verify ignored
4. **Setup:** npm/cargo/pip/poetry/go mod download
5. **Baseline tests:** npm test / cargo test / pytest / go test

**Safety:** Verify `.worktrees/` in `.gitignore` before creating.

---

### `skill-quality-validator`
**Trigger:** `skill validation`, `skill lint`, `skill quality`, `validate skill`

**Purpose:** Validates skill structure, frontmatter, references, dependencies, links, conventions.

**Checks:**
1. Frontmatter (required fields, name match, metadata)
2. Required sections (Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract, References)
3. References (local files exist, skill refs valid)
4. Circular dependencies (DFS)
5. External links (HEAD request, optional)
6. Conventions (kebab-case, formatting, no hardcoded paths)

**CI Integration:**
```yaml
# .github/workflows/skill-quality.yml
name: Skill Quality Check
on: [pull_request, push]
jobs:
  validate-skills:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npx tsx scripts/validate-skills.ts
```

---

### `gentle-agent-extension`
**Trigger:** `extend gentle-ai`, `add agent`, `add overlay`

**Purpose:** Package maintainer guide for adding bundled agents, overlays, skills, MCP, routing.

**Sections:**
1. Adding Bundled Agent
2. Adding Bundled Overlay
3. Adding Bundled Skill
4. Adding Bundled MCP
4. Test Locally (`pi -e ./src/extension.ts`)
5. Publish (`npm version patch`, `git push --tags`, `npm publish`)

---

## Skill Invocation Types

| Type | Description | Auto-invocation |
|------|-------------|-----------------|
| `disable-model-invocation: true` | User-invoked only (entry points) | NEVER |
| Default (omitted) | Can be invoked by model/orchestrator | Allowed |

**User-invoked skills:** `grill-me`, `grilling`
**Auto-invokable:** All others (architecture-quest, product-quest, etc.)

---

## Quick Reference: Skill by Trigger

| Trigger | Skill |
|---------|-------|
| `architecture quest`, `architectural exploration` | `architecture-quest` |
| `product quest`, `product decisions` | `product-quest` |
| `changelog`, `release notes`, `semver` | `changelog-generator` |
| `gentle-ai`, `diseño gentle` | `gentle-ui` |
| `GitHub automation`, `repos`, `issues`, `PRs` | `github-automation` |
| `grill`, `stress-test` | `grilling` |
| `/grill-me`, `grill me` | `grill-me` |
| `RED checks`, `tmpfs full`, `orphan processes` | `red-suite-hygiene` |
| `UI/UX design`, `components`, `accessibility` | `ui-design` |
| `UI/UX principles`, `Nielsen`, `WCAG` | `ui-ux-principles` |
| `git worktrees`, `isolated workspace` | `using-git-worktrees` |
| `skill validation`, `skill lint` | `skill-quality-validator` |
| `extend gentle-ai`, `add agent` | `gentle-agent-extension` |
| `/grill-me`, `grill me` | `grill-me` |