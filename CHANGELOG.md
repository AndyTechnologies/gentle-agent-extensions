# Changelog

All notable changes to `gentle-agent-extensions` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-11-04

### Added
- **Product Contract Verifier agent** (`resources/agents/product-contract-verifier.md`) — Read-only contractual verifier for Product Quest contracts; verifies PC-XX clause compliance before changelog generation
- **Product Contract Verifier routing** (`resources/routing/product-contract-verifier.md`) — Delegation rules for the verifier agent
- **Orchestrator integration** — Verifier runs after implementation, after Verify, before Changelog Generator

### Changed
- **Orchestrator overlay** — Added Product Contract Verifier execution section; runs after implementation/Verify, before Changelog Generator
- **Verification procedure** — Per-clause PASS/FAIL/UNVERIFIED/NOT_APPLICABLE with evidence; handles assumed/deferred clauses; cross-references AC-XX

## [1.3.4] - 2026-11-03

### Fixed
- **Extension load** — `registerBundledMcpServers()` now `async`; fixes `await import()` in sync function
- **Routing loader** — `loadBundledRouting()` now parses YAML list format (`triggers:
  - "item"`) instead of comma-separated inline
- **Agent sync** — `copyBundledAgentsToProject()` detects user-modified files (hash comparison); no longer overwrites local customizations; `conflicts` command shows differences
- **MCP lifecycle** — Registration separated from installation; `mcp-install` command requires explicit user authorization; allow-list of managers (npm, uv, pip, cargo); no `shell: true`
- **MCP handshake** — Retry logic with backoff; passes `server.env` and `server.cwd`; protocol version 2025-06-18
- **mcp-reload** — Only unregisters extension-owned servers (tracks bundled names)
- **mcp-health** — Returns `NO_SERVERS_CONFIGURED` when no servers configured
- **Routing consumption** — `before_agent_start` evaluates triggers and injects delegation instructions to orchestrator
- **Syntax** — Removed extra closing braces in `runDoctorChecks()`

### Changed
- **Quest → Interview** — Architecture Quest & Product Quest now use internal `quest-interview` (bounded 50-question interview via `grilling` primitive); `grill-me` / `grilling` remain user-invoked only (`disable-model-invocation: true`)
- **red-suite-hygiene** — Execution-scoped cleanup (`EXEC_ID` prefix); preview before delete; fixed `pkill` usage
- **using-git-worktrees** — Requires authorization before committing `.gitignore` changes
- **changelog-generator` — RDD failed → do NOT generate changelog; RDD disabled → generate with note
- **ui-design` — `gentle-design` reference marked as external (gentle-pi package)

### Added
- **Commands** — `mcp-install <server>`, `mcp-status` (shows available/disabled/failed/not_installed)
- **Conflict detection** — `gentle-extensions:conflicts` shows user-modified vs bundled
- **MCP status tracking** — `mcp-status` shows available/disabled/failed/not_installed

### Skills Updated
- `architecture-quest`, `product-quest`: use internal `quest-interview` instead of `grill-me`
- `red-suite-hygiene`: execution-scoped cleanup, fixed `pkill`
- `using-git-worktrees`: requires authorization for `.gitignore` commit
- `changelog-generator`: RDD failed blocks generation
- `ui-design`: `gentle-design` marked as external dependency

## [1.3.3] - 2026-11-03

### Fixed
- **CI/CD workflow** — Fixed invalid YAML (`env:` section with only comments) that prevented workflow execution
- **npm publish** — Trusted Publishers (OIDC) now works correctly; no token needed, 2FA does not block

## [1.3.2] - 2026-11-03

### Added
- **Routing loader** — `loadBundledRouting()` + `RoutingDefinition` interface; loads routing files on init
- **MCP Health Check** — Proper MCP protocol handshake (`initialize` → `notifications/initialized` → `tools/list`) for stdio/HTTP
- **MCP Install** — Auto-install via `install.manager` (npm, uv, pip, cargo, npx) before register
- **MCP Validation** — Duplicate names, transport values, exposure, auth types
- **Agent MCP Dependencies** — Doctor warns if agent declares missing MCP server
- **Tests** — 30 tests pass; validation for 8 new skills; `npm test` runs real tests

### Changed
- **Documentation** — `conventions.md`, `.manifest.json`, `extension.config.json` updated to `resources/` structure
- **Cleanup** — Removed unused `resources/mcp/` dir; updated `.engram/config.json`

## [1.3.1] - 2026-11-02

### Added
- **Product Quest skill** (`resources/skills/product-quest/`) — Detects and documents product/domain decisions in ODD tasks via `## Product Contract` with stable `PC-XX` clause IDs; gap detection for scope ambiguity, domain rules, user flows, data ownership, integration contracts, NFRs, edge cases, migration; coordinates with Architecture Quest via cross-references (`AC-XX` ↔ `PC-YY`)
- **Changelog Generator skill** (`resources/skills/changelog-generator/`) — Generates `CHANGELOG.md` from git diff after ODD/RDD completion; proposes minimum 2 SemVer version bumps with rationale; follows Keep a Changelog format (Added, Changed, Deprecated, Removed, Fixed, Security); no auto-commit
- **gentle-ui skill** (`resources/skills/gentle-ui/`) — Gentle-AI design system: dark-first zinc/magenta (web) and Rose Pine (TUI) tokens, structure, rules
- **github-automation skill** (`resources/skills/github-automation/`) — GitHub operations via `gh` CLI + `git` (bash); repos, issues, PRs, Actions, code search; no MCP, no token handling
- **grilling skill** (`resources/skills/grilling/`) — Bounded interview primitive (50-question budget, decision-tree discipline, one question at a time); user-invoked only
- **grill-me skill** (`resources/skills/grill-me/`) — User-invoked entry point for grilling sessions
- **red-suite-hygiene skill** (`resources/skills/red-suite-hygiene/`) — Generic test suite hygiene: cleans `/tmp` debris, kills orphan processes, checks ports before diagnosing failures; not SDD-specific
- **ui-design skill** (`resources/skills/ui-design/`) — UI/UX decisions checklist (accessibility, touch, performance, style, layout, typography, motion, forms, navigation, charts); records in design artifact
- **ui-ux-principles skill** (`resources/skills/ui-ux-principles/`) — HCD, Nielsen heuristics, WCAG 2.2, evaluation methods, metrics (SUS, SEQ), AI agent evaluation dimensions
- **using-git-worktrees skill** (`resources/skills/using-git-worktrees/`) — Isolated workspace via native tools or git worktree fallback; safety verification; generalized for any workflow

### Changed
- **Architecture Quest skill** — Wired to `grill-me`/`grilling` for blocking gaps; orchestrator owns questions via bounded interview
- **Product Quest skill** — Wired to `grill-me`/`grilling` for blocking gaps; orchestrator owns questions via bounded interview
- **Orchestrator overlay** — Integrated Product Quest, Changelog Generator, Quest→grill-me wiring; Skill Loading + Skill Wiring sections; updated RDD boundaries, verification, prohibited behaviors
- **github-automation skill** — **Rewritten**: removed MCP dependency (official + gh-git-mcp); now uses `gh` CLI + `git` directly via bash; no token handling in skill
- **Tests** — Added validation for changelog-generator and product-quest skills; updated peer dependency check to `^1.5.0`
- **Peer dependencies** — Updated to `@earendil-works/pi-*@^1.5.0` (Pi 1.5.0 compatibility)
- **MCP configuration** — Removed `donsetch` and `gh-git-mcp` from `~/.pi/agent/mcp.json`

### Removed
- Symlinks in `~/.agents/skills/` pointing to `~/.config/sdd-own/skills/` (23 symlinks removed)

## [1.3.0] - 2026-11-02

### Added
- **CI/CD: npm publish job with Trusted Publishers (OIDC)** — Verifies version not already on npm; uses `npm publish --provenance` without token; 2FA does not block OIDC
- **changelog-generator skill** — Detects version files (package.json, Cargo.toml, pyproject.toml, go.mod, etc.); reminds user to bump version before commit/tag

### Changed
- **ci-cd.yml** — Added publish-npm job parallel to release job

## [1.2.1] - 2026-11-01

### Added
- CHANGELOG.md at package root for Pi extension update changelog display
- `pi.changelogPath` in package.json pointing to CHANGELOG.md

### Changed
- Updated peer dependencies to `@earendil-works/pi-*@^1.5.0` (Pi 1.5.0 compatibility)

## [1.2.0] - 2026-11-01

### Added
- Bundled agents, overlays, routing, MCP servers, and skills
- Skills: `architecture-quest`, `gentle-agent-extension`
- Commands:
  - `gentle-extensions:sync` — Sync bundled agents to current project
  - `gentle-extensions:doctor` — Check bundled resources and installation
  - `gentle-extensions:fix` — Auto-fix non-destructive issues
  - `gentle-extensions:fix-destructive` — Auto-fix including destructive actions
  - `gentle-extensions:mcp-health` — Check MCP server connectivity
  - `gentle-extensions:conflicts` — Interactive conflict resolution
  - `gentle-extensions:status` — Show bundled resources status
  - `gentle-extensions:mcp-reload` — Reload MCP servers from bundled resources
- Extension update changelog support via `pi.changelogPath`

### Changed
- Updated peer dependencies to `@earendil-works/pi-*@^1.5.0`
- Updated `typebox` peer dependency to `^1.4.0`

### Fixed
- TypeBox version resolution (0.30.x doesn't exist)

## [1.1.0] - 2026-10-28

### Added
- Initial bundled resources structure
- Architecture Quest agent and overlay
- Gentle Agent Extension skill
- MCP server definitions
- Routing configuration

## [1.0.1] - 2026-10-25

### Fixed
- Package configuration and exports

## [1.0.0] - 2026-10-25

### Added
- Initial release of gentle-agent-extensions
- Core extension infrastructure for Pi

---

**Legend:**
- `Added` — New features
- `Changed` — Changes in existing functionality
- `Deprecated` — Soon-to-be removed features
- `Removed` — Removed features
- `Fixed` — Bug fixes
- `Security` — Vulnerability fixes