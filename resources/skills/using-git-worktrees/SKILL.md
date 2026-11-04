---
name: using-git-worktrees
description: "Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback. Trigger: creating or using isolated git worktrees for parallel work, including worktree safety verification."
license: MIT
metadata:
  author: Jesse Vincent
  version: "2.0"
  source: "https://github.com/obra/superpowers (skills/using-git-worktrees)"
---

# Using Git Worktrees

## Activation Contract

**Use this skill when:**
- Starting feature work that needs isolation from current workspace
- Before executing implementation plans requiring isolated workspace
- Creating or using isolated git worktrees for parallel work
- Worktree safety verification needed

**Do NOT use this skill for:**
- Work that doesn't require isolation
- When already in a suitable worktree

## Hard Rules

| Rule | Description |
|------|-------------|
| **Detect first** | Always check existing isolation before creating worktree |
| **Native tools first** | Prefer platform native tools (EnterWorktree, WorktreeCreate, /worktree) |
| **Git fallback only** | Use `git worktree add` only when no native tool available |
| **Safety first** | Verify worktree directory is gitignored before creation |
| **Consent required** | Ask user before creating worktree unless preference declared |
| **Baseline tests** | Run tests after setup to verify clean baseline |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation, report status |
| In submodule | Treat as normal repo |
| Native tool available | Use it (skip git fallback) |
| No native tool | Use git worktree fallback |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it if `.worktrees/` not present |
| Directory not ignored | Add to .gitignore, ask auth before commit |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail at baseline | Report failures, ask to proceed |

## Execution Steps

### Step 0: Detect Existing Isolation

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:**
```bash
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (not submodule):** Already in worktree. Report status, skip to Step 2.

**If `GIT_DIR == GIT_COMMON` (or submodule):** Normal repo. Ask for consent if not declared.

### Step 1: Create Isolated Workspace

**1a. Native Worktree Tools (preferred)**
- Use `EnterWorktree`, `WorktreeCreate`, `/worktree`, `--worktree` flag if available
- Skip to Step 2

**1b. Git Worktree Fallback (only if no native tool)**

**Directory Selection:**
1. Explicit user preference (if declared)
2. `.worktrees/` (preferred) or `worktrees/` at project root
3. Default to `.worktrees/` at project root

**Safety Verification:**
```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```
If NOT ignored: Add to .gitignore, **ask for authorization before committing**.

**Create Worktree:**
```bash
path="$LOCATION/$BRANCH_NAME"
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox fallback:** If `git worktree add` fails with permission error, work in current directory.

### Step 2: Project Setup

```bash
# Node.js
if [ -f package.json ]; then npm install; fi
# Rust
if [ -f Cargo.toml ]; then cargo build; fi
# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi
# Go
if [ -f go.mod ]; then go mod download; fi
```

### Step 3: Verify Clean Baseline

```bash
npm test / cargo test / pytest / go test ./...
```

If tests fail: Report failures, ask whether to proceed.
If tests pass: Report ready.

### Report

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Output Contract

Return:
- Worktree path and branch
- Test status (passing/failing)
- Ready status or failure details

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Native worktree tool available | Use it (Step 1a) |
| No native tool | Git worktree fallback (Step 1b) |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Default `.worktrees/` |
| Directory not ignored | Add to .gitignore + commit (with auth) |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## References

- Vendored from [`obra/superpowers`](https://github.com/obra/superpowers) — `skills/using-git-worktrees/SKILL.md` (MIT, Copyright 2025 Jesse Vincent). Adapted for ODD/any workflow use.