---
name: github-automation
description: "Trigger: GitHub automation and operations - repositories, issues, branches, commits, pull request review/merge/status, Actions workflows, and code search. Uses gh CLI and git directly via bash. Does NOT cover PR or issue creation (github-pr, branch-pr, chained-pr, and issue-creation own those), and never embeds tokens."
license: MIT
metadata:
  author: AndyTechnologies
  version: "2.0"
---

# GitHub Automation (bash/gh/git)

This skill uses the **gh CLI** and **git** directly via bash. No MCP servers, no remote endpoints, no token handling in the skill — `gh` manages auth entirely.

## Activation Contract

**Use this skill when:**
- GitHub repository operations (view, list, search)
- Issue triage and management
- Pull request review, merge, status checks
- GitHub Actions workflow operations
- Code search within repositories

**Do NOT use this skill for:**
- PR or issue creation (use github-pr, branch-pr, chained-pr, issue-creation skills)
- Embedding or handling tokens directly
- GitHub Enterprise Cloud operations without proper auth

## Hard Rules

| Rule | Description |
|------|-------------|
| **No tokens** | Never embed tokens. `gh` reads from `~/.config/gh/hosts.yml`. |
| **gh manages auth** | If auth fails, run `gh auth login` or `gh auth refresh`. |
| **Status before review** | `gh pr checks` first. Never approve PR with red checks. |
| **Verify before delete** | Confirm merged before branch deletion. |
| **Root cause triage** | Group issues by root cause, not one-by-one. |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Need GitHub operations | Use `gh` CLI + `git` bash commands |
| PR creation needed | Delegate to PR skills (github-pr, branch-pr, chained-pr) |
| Issue creation needed | Delegate to issue-creation skill |
| Auth error | `gh auth status` → `gh auth login` / `gh auth refresh` |
| Rate limit hit | Batch, cache, prefer local git for history |

## Execution Steps

1. **Verify auth** — `gh auth status` before any operation.
2. **Select operation** — Match task to appropriate gh/git command.
3. **Execute** — Run command via bash.
4. **Verify result** — Check output, status codes, evidence.
5. **Report** — Return evidence, links, status.

## Output Contract

Return operation results with:
- Command executed
- Output summary
- Evidence (links, logs, status)
- Next steps if applicable

## References

- `github-pr` skill — PR creation
- `branch-pr` skill — Branch-based PR workflow
- `chained-pr` skill — Stacked PRs
- `issue-creation` skill — Issue creation
- GitHub CLI docs: https://cli.github.com/manual/