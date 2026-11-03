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

## Prerequisites

- `gh` CLI ≥ 2.x installed and authenticated (`gh auth login`)
- `git` available on PATH
- For private repos: `gh auth status` shows appropriate scopes

**Never embed tokens.** `gh` reads from its config (`~/.config/gh/hosts.yml`). If a command fails with auth error, tell the user to run `gh auth login` or `gh auth refresh` — do not ask for the secret.

---

## Tool Surface (bash commands)

### Identity / Profile
```bash
gh api user                    # current user + scopes
gh api user --jq '.login'      # just username
```

### Repository metadata
```bash
gh repo view <owner>/<repo> --json name,defaultBranch,visibility,topics
gh repo list <owner> --json name,defaultBranch,visibility --limit 100
```

### Discovery (search)
```bash
gh api /search/code?q=repo:owner/name+<query> --jq '.items[] | {path, repository, html_url}'
gh api /search/repositories?q=<query> --jq '.items[] | {full_name, description, stargazers_count}'
gh api /search/issues?q=repo:owner/name+<query> --jq '.items[] | {number, title, state, labels, assignees}'
```

### Issue triage
```bash
gh issue list --repo <owner>/<repo> --state open --json number,title,labels,assignees,updatedAt --limit 50
gh issue view <number> --repo <owner>/<repo> --json number,title,body,labels,assignees,comments
gh issue comment <number> --repo <owner>/<repo> --body "…"          # write comment
gh issue edit <number> --repo <owner>/<repo> --add-label "bug"      # add label
gh issue edit <number> --repo <owner>/<repo> --add-assignee "@me"   # assign
```

### Branch operations
```bash
gh api repos/<owner>/<repo>/branches --jq '.[].name'                # list
gh api repos/<owner>/<repo>/branches/<branch>                       # get
# Create branch: use git locally, then push
git fetch origin <default-branch>
git checkout -b <new-branch> origin/<default-branch>
git push -u origin <new-branch>
# Delete branch (merged only)
gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>       # remote
git branch -d <branch>                                              # local (merged)
git branch -D <branch>                                              # local (force)
```

### Commit history
```bash
git log --oneline -20
git log --oneline <base>..<branch>
git diff <base>..<branch> --stat
git diff <base>..<branch>
```

### PR review / merge / status
```bash
gh pr list --repo <owner>/<repo> --state open --json number,title,headRefName,baseRefName,author,reviews,statusCheckRollup --limit 30
gh pr view <number> --repo <owner>/<repo> --json number,title,body,headRefName,baseRefName,author,reviews,statusCheckRollup,files,additions,deletions
gh pr diff <number> --repo <owner>/<repo>
gh pr checks <number> --repo <owner>/<repo>                         # status checks
# Review (approve / request changes / comment)
gh pr review <number> --repo <owner>/<repo> --approve --body "LGTM"
gh pr review <number> --repo <owner>/<repo> --request-changes --body "Needs fixes: …"
gh pr review <number> --repo <owner>/<repo> --comment --body "General feedback"
# Merge (only when checks green + base up to date)
gh pr merge <number> --repo <owner>/<repo> --squash --delete-branch  # or --merge / --rebase
```

### Actions (workflows)
```bash
gh run list --repo <owner>/<repo> --limit 20 --json databaseId,conclusion,status,headBranch,workflowName,createdAt
gh run view <run-id> --repo <owner>/<repo> --json conclusion,status,jobs
gh run view <run-id> --repo <owner>/<repo> --log                    # download logs
gh run rerun <run-id> --repo <owner>/<repo>                         # re-run failed
gh run rerun <run-id> --repo <owner>/<repo> --failed                # re-run only failed jobs
```

### File / content operations
```bash
gh api repos/<owner>/<repo>/contents/<path> --jq '.content' | base64 -d
gh api repos/<owner>/<repo>/git/blobs/<sha> --jq '.content' | base64 -d
# Prefer local git for diffs/history; use gh api for raw file content when needed
```

---

## Automation Workflows

### Repository ops
- Confirm repo exists and its defaults (`defaultBranch`, `visibility`, `topics`) before scripting: `gh repo view` first, always.
- Batch discovery: `gh repo list` + `gh api /search/repositories` (scope to org/owner before assuming location).

### Issue triage
Order: `gh issue list` (queue) → `gh issue view` (detail: labels, assignees, linked PR) → `gh issue comment` / `gh issue edit` (follow-up, labels, assignees) or signal to human.
- Triage by **root class**, never one-by-one: if the same failure mode shows up across issues, name the class and let the fix shrink the system, not spawn per-issue patches.
- Link issue to fixing PR via commit message keywords (`Fixes #NN`) — prefer over manual close.

### PR review / merge / status
- Status before review: `gh pr view` + `gh pr checks`. A PR with red checks is a review-with-evidence, not a merge candidate.
- Review: read the actual diff intent via `gh pr diff`, then `gh pr review` with comments tied to concrete lines. Approve only when diff + checks + context line up; `REQUEST_CHANGES` needs the same evidence standard.
- Merge: only when checks are green AND base branch is up to date. Prefer the merge method the repo's history uses (check recent merged PRs: `gh pr list --state merged --limit 10`).

### Branch / commit ops
- Create branches only from current default branch unless explicitly told otherwise. Name them scoped (`<scope>/<slug>`) to match repo convention.
- Delete branches only after confirming merged: `git merge-base --is-ancestor <branch> origin/<default>` or `gh pr view <number> --json mergedAt`. Never delete unmerged on a guess.

### Actions ops
- Failed run evidence: `gh run list` → `gh run view <id> --log`. The logs are the truth; never infer failure from the run name.
- Re-running a failed, flaky run is legitimate (timing/transient), but two consecutive re-runs of the same job without a code fix is a signal: read the logs and diagnose instead.

### Code search
- `gh api /search/code?q=repo:owner/name+<query>` — fastest "where is X" for known repo.
- Rate-limited harder than repo search — batch queries, prefer `gh api repos/.../contents/<path>` once you know the path.

---

## Pitfalls

| Pitfall | Avoidance |
|---------|-----------|
| Hardcoded API paths go stale | Use `gh api` with documented endpoints; `gh` versions track GitHub API |
| `401`/`403` from gh | Token/config issue — `gh auth status`, then `gh auth login` or `gh auth refresh`. Never ask for secret. |
| Rate limits | `gh api /rate_limit` to check. Search and Actions burn budget fast. Batch, cache, prefer local git for history. |
| Token in wrong place | Never inline token. `gh` reads from config only. |
| Reviewing without checks | `gh pr checks` first, always. Approving a PR with red check ships broken intent. |
| Deleting on a guess | Verify merged before delete (`gh pr view --json mergedAt` or `git merge-base --is-ancestor`). |
| Mixing gh and git confusingly | Use `gh` for GitHub-specific ops (PRs, issues, Actions, search). Use `git` for local history, diffs, branch mgmt. |

---

## Quick Reference

| Need | Command |
|------|---------|
| Who am I / scopes | `gh api user` |
| Repo facts | `gh repo view <owner>/<repo>` |
| Find code | `gh api /search/code?q=repo:owner/name+<query>` |
| Triage issues | `gh issue list` → `gh issue view` → `gh issue comment` / `gh issue edit` |
| Review a PR | `gh pr view` + `gh pr diff` + `gh pr checks` → `gh pr review` |
| Merge a PR | `gh pr checks` (green?) → `gh pr merge --squash --delete-branch` |
| Create a PR | **PR skills** (`github-pr`/`branch-pr`/`chained-pr`) |
| Failed CI | `gh run list` → `gh run view <id> --log` |
| Delete a branch | `gh pr view <num> --json mergedAt` (verify) → `gh api -X DELETE .../git/refs/heads/<branch>` |
| Trace a regression | `git log --oneline <base>..<branch>` / `git diff <base>..<branch>` |

---

## Notes for ODD Integration

- **No native RDD authority changes** — this skill is pure automation helper.
- **Verification rule**: only a named high-risk item (assess `escalate`) → independent `gentle-ai-verify`. GitHub automation itself is not a verifier.
- **Delegation**: when delegating to workers, pass repo, PR number, or issue number explicitly. Subagents do not inherit ambient `gh` config context — ensure `gh auth status` works in their environment.
- **Context transmission**: include relevant PR/issue numbers, branch names, and expected evidence (checks, diffs, logs) in task handoff.