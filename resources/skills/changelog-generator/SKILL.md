---
name: changelog-generator
description: "Trigger: changelog, change log, release notes, semver, version bump. Generates changelog.md from git diff after ODD/RDD completion, analyzes change substantiality, and proposes SemVer version bumps (at least 2 options)."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# Changelog Generator Skill

## Activation Contract

**Use this skill when:**
- ODD implementation is complete and RDD review has passed (if enabled)
- User requests changelog generation or release version proposal
- A feature branch is ready for merge and needs documented changes

**Do NOT use this skill for:**
- Mid-implementation changelog (only at completion)
- Projects without git history
- Automatic commits (changelog is advisory, user decides on commit)

## Hard Rules

| Rule | Description |
|------|-------------|
| **Post-ODD/RDD only** | Runs only after implementation complete and RDD passed (when RDD enabled) |
| **Git diff as source** | Uses `git diff` against base branch (main/master or user-specified) |
| **SemVer compliance** | Proposals follow Semantic Versioning 2.0.0 strictly |
| **At least 2 version options** | Always propose minimum 2 SemVer bump levels with rationale |
| **No auto-commit** | Generates changelog content and proposals; user commits |
| **Keep a Changelog format** | Output follows Keep a Changelog (https://keepachangelog.com/) |
| **Version bump reminder** | Before finalizing, remind user to bump version in project's version file (package.json, Cargo.toml, pyproject.toml, go.mod, etc.) |

## Knowledge Base

### SemVer Decision Matrix

| Change Type | SemVer Bump | Examples |
|-------------|-------------|----------|
| **Breaking** | MAJOR (X.0.0) | Removed public API, changed contract signatures, removed config options, DB schema breaking migrations, CLI flag removal/rename |
| **Feature** | MINOR (0.Y.0) | New command, new optional flag, new API endpoint, new agent/skill, new overlay, new MCP server, new exported function |
| **Fix** | PATCH (0.0.Z) | Bug fix, typo, performance improvement, test fix, docs correction, dependency patch update |
| **Internal** | NONE (or PATCH if user wants) | Refactor without behavior change, test-only changes, build/CI changes, formatting |

### Substantiality Analysis Factors

| Factor | Weight | Assessment |
|--------|--------|------------|
| **Files changed** | High | >10 files = substantial; >25 = major |
| **Lines added/removed** | High | >500 lines = substantial; >1500 = major |
| **Public API surface** | Critical | Any breaking change = MAJOR; new exports = MINOR |
| **Configuration changes** | High | New required config = MINOR; breaking config = MAJOR |
| **Data/migrations** | Critical | Schema changes = MAJOR; new optional fields = MINOR |
| **Dependencies** | Medium | Major version bump = MINOR (or MAJOR if breaking); minor/patch = PATCH |
| **Test coverage** | Medium | New tests for new behavior = supports MINOR; only test fixes = PATCH |
| **Documentation** | Low | New docs for features = supports MINOR; typo fixes = PATCH |

## Decision Gates

| Situation | Action |
|-----------|--------|
| No changes detected | Report "No changes since base branch" |
| Only breaking changes | Propose MAJOR only (with clear warning) |
| Only features + fixes | Propose MINOR and PATCH |
| Only fixes | Propose PATCH |
| Mixed breaking + features | Propose MAJOR and MINOR (explain both) |
| User requests specific bump | Honor if valid; warn if mismatch |
| RDD not enabled / failed | Still generate changelog; note RDD status |

## Execution Steps

1. **Determine base branch**
   - Default: `main` or `master` (whichever exists)
   - Allow user override via `--base <branch>`
   - Verify base branch exists locally or fetch

2. **Compute git diff**
   - `git diff <base>...HEAD --stat` for summary
   - `git diff <base>...HEAD` for full diff
   - Categorize by file type: source, test, docs, config, build

3. **Analyze each change**
   - Parse diff hunks for added/removed/modified
   - Detect: new functions, removed exports, signature changes, config changes, new files, deleted files
   - Classify each change: breaking | feature | fix | internal | docs | test | build

4. **Aggregate substantiality score**
   - Count files, lines, API changes, config changes, data changes
   - Weight by decision matrix
   - Determine primary and secondary SemVer candidates

5. **Generate changelog content**
   - Follow Keep a Changelog sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
   - Group by category with file references
   - Include commit messages when available (from feature branch)
   - Reference ODD task document and RDD review if applicable

6. **Propose version bumps (min 2)**
   - Primary recommendation with rationale
   - At least one alternative with rationale
   - Explain what would be needed for each level

7. **Detect project version file**
   - Check for common version files in repo root:
     - `package.json` → `version` field (npm/Node.js)
     - `Cargo.toml` → `version` field (Rust)
     - `pyproject.toml` → `project.version` or `tool.poetry.version` (Python)
     - `go.mod` → module version (Go)
     - `setup.py` / `setup.cfg` → `version` (Python legacy)
     - `pom.xml` → `<version>` (Maven/Java)
     - `build.gradle` / `build.gradle.kts` → `version` (Gradle)
     - `mix.exs` → `@version` (Elixir)
     - `composer.json` → `version` (PHP)
     - `version.txt` / `VERSION` → plain text version
   - Report detected version file(s) and current version

8. **Write/update CHANGELOG.md**
   - Prepend new version section at top
   - Preserve existing history
   - Use format: `## [X.Y.Z] - YYYY-MM-DD`

9. **Present to user with version bump reminder**
   - Show generated changelog section
   - Show version proposals with rationale
   - **Remind user to bump version in detected version file(s)** before committing/tagging
   - Ask user to confirm, modify, or reject

10. **Optional: Auto-bump version file**
    - If user confirms, offer to update the detected version file(s) with the chosen version
    - User must explicitly approve any file modification

## Output Contract

Upon completion, deliver:

- [ ] Generated changelog section (markdown) for the upcoming version
- [ ] At least 2 SemVer version proposals with detailed rationale
- [ ] Substantiality analysis summary (files, lines, categories, scores)
- [ ] Updated CHANGELOG.md content (not committed)
- [ ] Clear recommendation and alternatives
- [ ] Detected version file(s) and current version
- [ ] **Explicit reminder to bump version in version file(s)** before commit/tag

## SemVer Proposal Format

```
VERSION PROPOSALS:

Primary: X.Y.Z (MAJOR|MINOR|PATCH)
Rationale: [Specific changes driving this recommendation]
  - Breaking: [list]
  - Features: [list]
  - Fixes: [list]

Alternative 1: X.Y.Z (MAJOR|MINOR|PATCH)
Rationale: [What would justify this level instead]
  - Would require: [specific additional changes]

Alternative 2: X.Y.Z (MAJOR|MINOR|PATCH) [if applicable]
Rationale: [Conservative/aggressive alternative]
  - Would require: [specific changes]

SUBSTANTIALITY:
- Files changed: N (source: N, test: N, docs: N, config: N, build: N)
- Lines: +N/-N
- Public API changes: N breaking, N additions
- Config changes: N breaking, N additions
- Data/migrations: N breaking, N additions
```

## References

- Keep a Changelog: https://keepachangelog.com/en/1.0.0/
- Semantic Versioning: https://semver.org/spec/v2.0.0.html
- Gentle Pi RDD: rdd-defect-workflow skill
- Gentle AI ODD: gentle-ai skill