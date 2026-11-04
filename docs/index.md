# Documentation Index

## Getting Started

- [Getting Started](./getting-started.md) - Quick start guide and first steps
- [Commands Reference](./commands-reference.md) - Complete command reference
- [Skills Reference](./skills-reference.md) - All 13 skills detailed

## Deep Dives

- [Architecture](./architecture.md) - System architecture and internals
- [Configuration](./configuration.md) - Complete configuration guide
- [Development](./development.md) - Development workflow and testing

## Quick Links

### By Task

| Goal | Document |
|------|----------|
| Install & first steps | [Getting Started](./getting-started.md) |
| Find a command | [Commands Reference](./commands-reference.md) |
| Understand a skill | [Skills Reference](./skills-reference.md) |
| Configure the extension | [Configuration](./configuration.md) |
| Start developing | [Development](./development.md) |
| Understand internals | [Architecture](./architecture.md) |

### By Feature Area

| Feature | Primary Doc |
|---------|-------------|
| Commands | [Commands Reference](./commands-reference.md) |
| Skills | [Skills Reference](./skills-reference.md) |
| Architecture | [Architecture](./architecture.md) |
| Configuration | [Configuration](./configuration.md) |
| Development | [Development](./development.md) |

## Documentation Structure

```
docs/
├── index.md                    # This file
├── getting-started.md          # Quick start & first steps
├── commands-reference.md       # Complete command reference
├── skills-reference.md         # All 13 skills detailed
├── architecture.md             # System architecture
├── configuration.md            # Configuration guide
└── development.md              # Development workflow
```

## Quick Command Card

```
┌─────────────────────────────────────────────────────────────┐
│                    gentle-extensions QUICK REF               │
├─────────────────────────────────────────────────────────────┤
│ STATUS & SYNC                                                │
│   :status          Quick resource status                     │
│   :sync            Sync bundled agents                       │
│   :sync --force    Force overwrite conflicts                 │
├─────────────────────────────────────────────────────────────┤
│ DIAGNOSTICS                                                  │
│   :doctor                    Quick health check              │
│   :doctor --graph            Resource graph                  │
│   :doctor --graph --dot      Graph + GraphViz DOT           │
│   :doctor --resources        Resource conflicts             │
│   :doctor --routing          Routing validation             │
│   :doctor --mcp-health       MCP health checks              │
│   :doctor --graph --dot      Full graph + DOT               │
│   :resources                 Full resource inventory        │
│   :routing                   Routing rules detail           │
│   :conflicts                 3-way diff conflicts           │
│   :conflicts --force         Force overwrite                │
├─────────────────────────────────────────────────────────────┤
│ MCP                                                           │
│   :mcp-status         Status (available/disabled/failed)    │
│   :mcp-install <name>  Install MCP server                   │
│   :mcp-uninstall <name> Uninstall MCP server                │
│   :mcp-reload           Reload MCP servers                  │
│   :mcp-health           Real MCP handshake                  │
│   :mcp-status           Lifecycle status                    │
│   :mcp-logs <name>      View logs (stub)                    │
├─────────────────────────────────────────────────────────────┤
│ QUESTS                                                        │
│   "Run architecture quest for <feature>"                    │
│   "Run product quest for <feature>"                         │
│   "Use architecture-council to verify AC-XX"               │
│   "Verify product contract for <feature>"                  │
│   "Generate changelog for this release"                    │
├─────────────────────────────────────────────────────────────┤
│ GRILLING                                                       │
│   /grill-me              Start bounded interview            │
│   /grill-me <topic>      Grill specific topic               │
└─────────────────────────────────────────────────────────────┘
```

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v1.4.3 | 2026-11-03 | Diagnostic & Observability (Epic 6) |
| v1.4.2 | 2026-11-03 | Skill Quality Validator (Epic 5) |
| v1.4.1 | 2026-11-02 | Product Contract Verifier (Epic 4) |
| v1.4.0 | 2026-11-02 | Epics 1-3: Graph, Routing, MCP |
| v1.3.5 | 2026-11-03 | CI/CD Fix (Trusted Publishers) |
| v1.3.4 | 2026-11-02 | Stabilization Release |
| v1.3.3 | 2026-11-02 | CI/CD Fix |
| v1.3.2 | 2026-11-02 | CI/CD Fix |
| v1.3.1 | 2026-11-02 | CI/CD Fix |
| v1.3.0 | 2026-11-02 | Product Quest, Changelog, 8 Skills |

## Contributing to Documentation

1. Edit `.md` files in `docs/`
2. Update this index if adding new files
3. Follow existing style and formatting
3. Run `npm test` to verify links work