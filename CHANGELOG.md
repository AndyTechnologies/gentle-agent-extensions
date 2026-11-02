# Changelog

All notable changes to `gentle-agent-extensions` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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