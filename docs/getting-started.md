# Getting Started with gentle-agent-extensions

## Quick Start

### Prerequisites
- [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) or Pi coding agent
- Pi 1.5.0+

### Installation

```bash
# From npm (recommended)
pi install npm:gentle-agent-extensions@latest

# From Git (specific version)
pi install git:github.com/AndyTechnologies/gentle-agent-extensions@v1.4.3

# Local development
pi install ./gentle-agent-extensions
```

### Verify Installation

```bash
# In Pi
/gentle-extensions:status
```

You should see:
```
gentle-agent-extensions status:
  Package root: /path/to/gentle-agent-extensions
  Bundled agents: architecture-council
  Bundled overlays: orchestrator
  Bundled skills: present
  Bundled routing: architecture-council
```

## First Steps

### 1. Run Architecture Quest

```bash
# In Pi
"Run architecture quest for my new feature"
```

This will:
1. Analyze your request for architectural implications
2. Identify blocking gaps that need decisions
3. Launch a bounded interview (grill-me) for each blocking gap
4. Produce an Architectural Contract (AC-01, AC-02, ...)

### 2. Run Product Quest

```bash
# In Pi
"Run product quest for my new feature"
```

This will:
1. Scan for product/domain uncertainties
2. Identify scope ambiguity, missing rules, user flows, etc.
3. Launch interviews for blocking gaps
4. Produce a Product Contract (PC-01, PC-02, ...)

### 3. Run Architecture Council

```bash
# After implementation
"Use architecture-council to verify AC-01"
```

The council verifies your implementation matches the architectural contract.

### 4. Generate Changelog

```bash
# After all tasks done and RDD passed
"Generate changelog for this release"
```

Produces:
- CHANGELOG.md entry (Keep a Changelog format)
- Minimum 2 SemVer version proposals with rationale

## Key Workflows

### ODD + Quest Integration

```
User Request
    │
    ├─► Architecture Quest ──► Architectural Contract (AC-XX)
    │
    ├─► Product Quest ──► Product Contract (PC-XX)
    │
    └─► Implementation (ODD)
          │
          ▼
      gentle-ai-verify (if needed)
          │
          ▼
      Architecture Council ──► Verify AC-XX
          │
          ▼
      Product Contract Verifier ──► Verify PC-XX
          │
          ▼
      Changelog Generator ──► CHANGELOG.md + SemVer proposals
          │
          ▼
      User confirms ──► Commit + Tag + Release
```

### MCP Lifecycle

```bash
# Check MCP status
/gentle-extensions:mcp-status

# Install MCP server (requires confirmation)
/gentle-extensions:mcp-install github

# Check MCP health (real handshake)
/gentle-extensions:mcp-health

# View MCP logs (stub)
/gentle-extensions:mcp-logs github
```

### Diagnostic Commands

```bash
# Full deep diagnostic
/gentle-extensions:doctor

# With specific flags
/gentle-extensions:doctor --graph --resources --routing --mcp-health

# Resource graph as GraphViz DOT
/gentle-extensions:doctor --graph --dot

# Check resource conflicts
/gentle-extensions:conflicts

# Routing rules
/gentle-extensions:routing

# MCP health check (real handshake)
/gentle-extensions:mcp-health

# Resource status
/gentle-extensions:resources
```

## Next Steps

- [Commands Reference](./commands-reference.md)
- [Skills Reference](./skills-reference.md)
- [Configuration Guide](./configuration.md)
- [Architecture Overview](./architecture.md)
- [Development Guide](./development.md)