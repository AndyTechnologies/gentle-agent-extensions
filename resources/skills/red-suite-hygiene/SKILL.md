---
name: red-suite-hygiene
description: "Trigger: RED checks, test suite failures, write error, Disk quota exceeded, tmpfs full, orphaned processes, fake API. Clean test-environment debris before diagnosing test suite failures so environmental noise never masquerades as a contract defect."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "2.0"
---

# Test Suite Hygiene (Generic)

## Activation Contract

Load before running or diagnosing any test suite that:
- Creates temporary directories/sandboxes in `/tmp`
- Spawns background processes (fake APIs, mock servers, etc.)
- Has shown `write error`, `Disk quota exceeded`, `tmpfs full`, or unexpected exit codes
- May have been interrupted mid-run (power loss, kill, crash)

## Hard Rules

- **NEVER diagnose a suite failure as a code/contract defect while the environment is degraded.** Clean first, re-run, then judge.
- **NEVER use `pkill -f` with a pattern that can match your own shell cmdline** (e.g., `fake_api`, `test`, `node`, `python`) — the tool shell can kill itself. Use the explicit PID list from `pgrep -af`.
- Test harnesses often clean up child processes on EXIT but **do NOT remove temporary directories** — stale dirs accumulate and fill `/tmp`.
- Only a FAIL reproduced after a full sweep + clean re-run is a candidate code/contract defect.

## Common Environmental Noise Patterns

| Signal | Typical Cause | Action |
|--------|---------------|--------|
| `write error` / `Disk quota exceeded` / `fflush failed` / `No space left on device` | `/tmp` tmpfs full from stale test dirs | Sweep stale dirs, re-run |
| `exit 2` / `exit 127` / `command not found` in fresh sandbox | Environment mismatch, missing deps | Inspect setup/install, not test code |
| Flaky FAILs that pass on re-run | Resource contention, port conflicts, timing | Sweep orphans, check port usage, re-run |
| `fake_api`, `mock_server`, `chrome`, `playwright` processes with ppid=1 | Orphans from interrupted run | Kill confirmed PID list |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Suite passes after clean run | No action needed |
| FAIL with environmental errors nearby | Classify as invalid, re-run after sweep |
| FAIL persists after clean run | Real defect — investigate contract |
| Orphan processes found | Kill confirmed PIDs only |
| /tmp > 70% full | Sweep before running |
| Flaky FAILs pass on re-run | Investigate resource contention |

## Execution Steps

### 1. Preflight: Check `/tmp` health
```bash
df -h /tmp
df -i /tmp          # inode exhaustion also causes write errors
```
If usage > 70% (space or inodes), sweep before anything else.

### 2. Sweep test-created directories
**Identify the pattern first** (project-specific):
```bash
# Common patterns — adapt to project:
ls -d /tmp/test-* /tmp/suite-* /tmp/sandbox-* /tmp/red-* /tmp/opencode-* /tmp/vitest-* /tmp/jest-* /tmp/pytest-* /tmp/cargo-* 2>/dev/null
```
**Remove only test harness dirs owned by current execution** (never user data):
```bash
# Use execution-specific prefix to avoid cross-session conflicts
EXEC_ID="${RED_EXEC_ID:-$$}"
rm -rf /tmp/test-${EXEC_ID}-* /tmp/suite-${EXEC_ID}-* /tmp/sandbox-${EXEC_ID}-* /tmp/red-${EXEC_ID}-* 2>/dev/null
```
**Preview before delete** (dry-run):
```bash
ls -d /tmp/test-${EXEC_ID}-* /tmp/suite-${EXEC_ID}-* /tmp/sandbox-${EXEC_ID}-* /tmp/red-${EXEC_ID}-* 2>/dev/null
```

### 3. Orphan process check
```bash
# Find processes by name pattern — adapt to project:
pgrep -af 'fake_api|mock_server|test_runner|chromedriver|playwright|vitest|jest'
```
**Kill only confirmed orphans** (ppid=1 or parent died):
```bash
# Example: kill specific PIDs individually
kill -9 <PID1> <PID2> ...
# Or use pkill with full command match (requires pgrep -f first):
pgrep -f "python.*fake_api\.py" | xargs -r kill -9
```

### 4. Port / resource check
```bash
# Check for stuck listeners on common test ports
ss -tlnp | grep -E ':3000|:3001|:4000|:8000|:8080|:9000'
# Kill only if owned by test processes
```

### 5. Clean re-run
```bash
# Run the project's test command with timeout
timeout 300 <project-test-command> > /tmp/test_clean.log 2>&1
```

### 6. Classify failures
```bash
# Grep log for environmental errors near each FAIL
grep -n -B5 -A5 'write error\|Disk quota\|No space left\|fflush failed' /tmp/test_clean.log
```
If environmental errors appear near a FAIL → that FAIL is **invalid** (suite ran degraded).
Only environment-clean, reproduced FAILs are real defects.

## Output Contract

Report:
- Preflight `df -h /tmp` and `df -i /tmp` state
- Stale dir count found + cleaned
- Orphan process count found + killed
- Port conflicts resolved
- Suite PASS/FAIL/SKIP totals
- For each FAIL: environmental-vs-contract classification backed by exact log line

## Project Adaptation

**Before first use in a project**, identify and document:
1. Test command (e.g., `npm test`, `cargo test`, `pytest`, `go test ./...`)
2. Temp dir patterns (e.g., `/tmp/sdd-red.*`, `/tmp/vitest-*`, `/tmp/pytest-*`)
3. Background process names (e.g., `fake_api.py`, `mock_server`, `chromedriver`)
4. Common test ports

Add these to a project-local `RED_HYGIENE.md` or the skill's project notes.

## References

- Generic pattern — adapt to any test harness that uses `/tmp` sandboxes and background processes
- The principle: **environment first, code second**