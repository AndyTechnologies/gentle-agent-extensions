#!/usr/bin/env bash
# sync.sh - Synchronize gentle-agent-extensions with active Pi profile
#
# This script synchronizes custom agents, overlays, routing, skills, and MCP servers
# with the active Pi installation. It is idempotent and supports dry-run/check modes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Synchronize gentle-agent-extensions with the active Pi profile.

Options:
  --profile PROFILE    Installation profile: pi, gentle-shell, gentle-shell-linked (default: pi)
  --agent-home PATH    Explicit agent home directory (overrides profile)
  --dry-run            Show what would be done without making changes
  --check              Validate configuration and report issues (exit code 0 if ok, 1 if issues)
  -h, --help           Show this help

Examples:
  $0                      # Full sync
  $0 --dry-run            # Preview changes
  $0 --check              # Validate only
  $0 --profile gentle-shell
EOF
}

PROFILE="pi"
AGENT_HOME=""
DRY_RUN=false
CHECK_MODE=false

while [[ $# -gt 0 ]]; do
	case $1 in
		--profile)
			PROFILE="$2"
			shift 2
			;;
		--agent-home)
			AGENT_HOME="$2"
			shift 2
			;;
		--dry-run)
			DRY_RUN=true
			shift
			;;
		--check)
			CHECK_MODE=true
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			log_error "Unknown option: $1"
			usage
			exit 1
			;;
	esac
done

# Determine agent home
if [[ -z "$AGENT_HOME" ]]; then
	case "$PROFILE" in
		pi) AGENT_HOME="${HOME}/.pi/agent" ;;
		gentle-shell) AGENT_HOME="${HOME}/.local/share/gentle-shell/agent" ;;
		gentle-shell-linked) AGENT_HOME="${HOME}/.pi/agent" ;;
		*) log_error "Unknown profile: $PROFILE"; exit 1 ;;
	esac
fi

log_info "Syncing gentle-agent-extensions"
log_info "Profile: $PROFILE"
log_info "Agent home: $AGENT_HOME"
log_info "Project root: $PROJECT_ROOT"

if [[ "$DRY_RUN" == "true" ]]; then
	log_warn "DRY RUN mode - no changes will be made"
fi

if [[ "$CHECK_MODE" == "true" ]]; then
	log_info "CHECK mode - validation only"
fi

# Track changes and issues
CHANGES=0
ISSUES=0
WARNINGS=0

# Source directories
AGENTS_SRC="${PROJECT_ROOT}/agents"
OVERLAYS_SRC="${PROJECT_ROOT}/overlays"
ROUTING_SRC="${PROJECT_ROOT}/routing"
SKILLS_SRC="${PROJECT_ROOT}/skills"
MCP_SRC="${PROJECT_ROOT}/mcp"

# Target directories
AGENT_HOME_EXTENSIONS="${AGENT_HOME}/extensions"
PROJECT_AGENTS_DIR="${PROJECT_ROOT}/.pi/agents"
PROJECT_SUBAGENTS_DIR="${PROJECT_ROOT}/.pi/subagents"

# Manifest
MANIFEST="${PROJECT_ROOT}/.manifest.json"

# Helper: read manifest
read_manifest() {
	if [[ -f "$MANIFEST" ]]; then
		cat "$MANIFEST"
	else
		echo '{"version":"1.0","managedPaths":{}}'
	fi
}

# Helper: write manifest
write_manifest() {
	if [[ "$DRY_RUN" == "false" && "$CHECK_MODE" == "false" ]]; then
		echo "$1" > "$MANIFEST"
	fi
}

# Helper: update manifest path list
update_manifest_paths() {
	local key="$1"
	local paths_json="$2"
	local manifest
	manifest=$(read_manifest)
	if command -v jq &> /dev/null; then
		echo "$manifest" | jq --arg key "$key" --argjson paths "$paths_json" '.managedPaths[$key] = $paths'
	else
		log_warn "jq not available, manifest not updated (install jq for full manifest support)"
		echo "$manifest"
	fi
}

# 1. Validate project structure
log_info "Validating project structure..."

for dir in "$AGENTS_SRC" "$OVERLAYS_SRC" "$ROUTING_SRC" "$SKILLS_SRC" "$MCP_SRC"; do
	if [[ ! -d "$dir" ]]; then
		log_warn "Directory missing: $dir"
		((WARNINGS++))
	fi
done

# 2. Sync agents
log_info "Syncing agents..."

if [[ -d "$AGENTS_SRC" ]]; then
	if [[ "$DRY_RUN" == "false" && "$CHECK_MODE" == "false" ]]; then
		mkdir -p "$PROJECT_AGENTS_DIR"
	fi

	MANAGED_AGENTS=()

	for agent_file in "$AGENTS_SRC"/*.md; do
		[[ -f "$agent_file" ]] || continue

		agent_name=$(basename "$agent_file" .md)
		target_file="${PROJECT_AGENTS_DIR}/${agent_name}.md"

		if ! head -20 "$agent_file" | grep -q "^---$"; then
			log_warn "Agent $agent_name: missing frontmatter delimiter"
			((WARNINGS++))
		fi

		if ! grep -q "^name:" "$agent_file"; then
			log_warn "Agent $agent_name: missing 'name' in frontmatter"
			((WARNINGS++))
		fi

		if [[ "$DRY_RUN" == "true" ]]; then
			if [[ -f "$target_file" ]]; then
				if ! cmp -s "$agent_file" "$target_file"; then
					log_info "Would update: $agent_name -> $target_file"
					((CHANGES++))
				else
					log_info "Unchanged: $agent_name"
				fi
			else
				log_info "Would create: $agent_name -> $target_file"
				((CHANGES++))
			fi
		elif [[ "$CHECK_MODE" == "false" ]]; then
			if [[ -f "$target_file" ]]; then
				if ! cmp -s "$agent_file" "$target_file"; then
					cp "$agent_file" "$target_file"
					log_success "Updated agent: $agent_name"
					((CHANGES++))
				else
					log_info "Unchanged: $agent_name"
				fi
			else
				cp "$agent_file" "$target_file"
				log_success "Created agent: $agent_name"
				((CHANGES++))
			fi
		fi

		MANAGED_AGENTS+=("$target_file")
	done

	if [[ "$DRY_RUN" == "false" && "$CHECK_MODE" == "false" ]]; then
		paths_json=$(printf '"%s",' "${MANAGED_AGENTS[@]}" | sed 's/,$//')
		paths_json="[$paths_json]"
		new_manifest=$(update_manifest_paths "agents" "$paths_json")
		write_manifest "$new_manifest"
	fi
else
	log_warn "Agents source directory not found: $AGENTS_SRC"
	((WARNINGS++))
fi

# 3. Validate overlays
log_info "Validating overlays..."

if [[ -d "$OVERLAYS_SRC" ]]; then
	for overlay_file in "$OVERLAYS_SRC"/*.overlay.md; do
		[[ -f "$overlay_file" ]] || continue

		overlay_name=$(basename "$overlay_file" .overlay.md)

		if ! head -20 "$overlay_file" | grep -q "^---$"; then
			log_warn "Overlay $overlay_name: missing frontmatter delimiter"
			((WARNINGS++))
		fi

		if ! grep -q "^target:" "$overlay_file"; then
			log_error "Overlay $overlay_name: missing 'target' in frontmatter"
			((ISSUES++))
		fi

		target=$(grep "^target:" "$overlay_file" | head -1 | sed 's/^target: *//')
		log_info "Overlay validated: $overlay_name -> target: $target"
	done
else
	log_warn "Overlays source directory not found: $OVERLAYS_SRC"
	((WARNINGS++))
fi

# 4. Validate routing
log_info "Validating routing..."

if [[ -d "$ROUTING_SRC" ]]; then
	for routing_file in "$ROUTING_SRC"/*.md; do
		[[ -f "$routing_file" ]] || continue

		routing_name=$(basename "$routing_file" .md)

		if ! grep -q "^agent:" "$routing_file"; then
			log_warn "Routing $routing_name: missing 'agent' in frontmatter"
			((WARNINGS++))
		fi

		agent=$(grep "^agent:" "$routing_file" | head -1 | sed 's/^agent: *//')
		log_info "Routing validated: $routing_name -> agent: $agent"
	done
else
	log_warn "Routing source directory not found: $ROUTING_SRC"
	((WARNINGS++))
fi

# 5. Validate skills
log_info "Validating skills..."

if [[ -d "$SKILLS_SRC" ]]; then
	for skill_dir in "$SKILLS_SRC"/*/; do
		[[ -d "$skill_dir" ]] || continue

		skill_name=$(basename "$skill_dir")
		skill_file="${skill_dir}SKILL.md"

		if [[ ! -f "$skill_file" ]]; then
			log_warn "Skill $skill_name: missing SKILL.md"
			((WARNINGS++))
			continue
		fi

		for section in "Activation Contract" "Hard Rules" "Decision Gates" "Execution Steps" "Output Contract" "References"; do
			if ! grep -q "^## $section" "$skill_file"; then
				log_warn "Skill $skill_name: missing section '$section'"
				((WARNINGS++))
			fi
		done

		if ! head -10 "$skill_file" | grep -q "^---$"; then
			log_warn "Skill $skill_name: missing frontmatter"
			((WARNINGS++))
		fi

		log_info "Skill validated: $skill_name"
	done
else
	log_warn "Skills source directory not found: $SKILLS_SRC"
	((WARNINGS++))
fi

# 6. Validate MCP server definitions
log_info "Validating MCP servers..."

if [[ -d "$MCP_SRC" ]]; then
	for mcp_file in "$MCP_SRC"/*.mcp.json; do
		[[ -f "$mcp_file" ]] || continue

		mcp_name=$(basename "$mcp_file" .mcp.json)

		if ! command -v jq &> /dev/null; then
			log_warn "MCP $mcp_name: jq not available, skipping JSON validation"
		else
			if ! jq empty "$mcp_file" 2>/dev/null; then
				log_error "MCP $mcp_name: invalid JSON syntax"
				((ISSUES++))
				continue
			fi

			name=$(jq -r '.name // empty' "$mcp_file")
			description=$(jq -r '.description // empty' "$mcp_file")
			transport=$(jq -r '.transport // empty' "$mcp_file")

			if [[ -z "$name" ]]; then
				log_error "MCP $mcp_name: missing 'name' field"
				((ISSUES++))
			fi
			if [[ -z "$description" ]]; then
				log_error "MCP $mcp_name: missing 'description' field"
				((ISSUES++))
			fi
			if [[ -z "$transport" ]]; then
				log_error "MCP $mcp_name: missing 'transport' field"
				((ISSUES++))
			fi

			if [[ "$transport" == "stdio" ]]; then
				command=$(jq -r '.command // empty' "$mcp_file")
				if [[ -z "$command" ]]; then
					log_error "MCP $mcp_name: stdio transport requires 'command' field"
					((ISSUES++))
				fi
			elif [[ "$transport" == "http" ]]; then
				url=$(jq -r '.url // empty' "$mcp_file")
				if [[ -z "$url" ]]; then
					log_error "MCP $mcp_name: http transport requires 'url' field"
					((ISSUES++))
				fi
			else
				log_error "MCP $mcp_name: transport must be 'stdio' or 'http'"
				((ISSUES++))
			fi

			if [[ -n "$name" ]] && ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
				log_error "MCP $mcp_name: name must contain only letters, digits, _, and -"
				((ISSUES++))
			fi

			if command -v jq &> /dev/null; then
				env_keys=$(jq -r '.env | keys[]' "$mcp_file" 2>/dev/null || true)
				for key in $env_keys; do
					value=$(jq -r ".env[\"$key\"]" "$mcp_file")
					if [[ -n "$value" ]] && ! [[ "$value" =~ ^\$\{ ]]; then
						key_lower=$(echo "$key" | tr '[:upper:]' '[:lower:]')
						if [[ "$key_lower" =~ (secret|token|key|password) ]]; then
							log_warn "MCP $mcp_name: env '$key' may contain hardcoded secret (use \${VAR} syntax)"
							((WARNINGS++))
						fi
					fi
				done
			fi

			log_info "MCP validated: $mcp_name ($transport)"
		fi
	done
else
	log_warn "MCP source directory not found: $MCP_SRC"
	((WARNINGS++))
fi

# 7. Check for duplicate agent names
log_info "Checking for conflicts..."

GLOBAL_AGENTS_DIRS=("$AGENT_HOME/agents" "$AGENT_HOME/subagents")
declare -A GLOBAL_AGENTS

for dir in "${GLOBAL_AGENTS_DIRS[@]}"; do
	if [[ -d "$dir" ]]; then
		for file in "$dir"/*.md; do
			[[ -f "$file" ]] || continue
			name=$(basename "$file" .md)
			GLOBAL_AGENTS["$name"]="$dir"
		done
	fi
done

if [[ -d "$AGENTS_SRC" ]]; then
	for agent_file in "$AGENTS_SRC"/*.md; do
		[[ -f "$agent_file" ]] || continue
		agent_name=$(basename "$agent_file" .md)
		if [[ -n "${GLOBAL_AGENTS[$agent_name]:-}" ]]; then
			log_warn "Project agent '$agent_name' shadows global agent in ${GLOBAL_AGENTS[$agent_name]}"
			((WARNINGS++))
		fi
	done
fi

# 8. Check overlay targets exist
log_info "Checking overlay targets..."
if [[ -d "$OVERLAYS_SRC" ]]; then
	for overlay_file in "$OVERLAYS_SRC"/*.overlay.md; do
		[[ -f "$overlay_file" ]] || continue
		target=$(grep "^target:" "$overlay_file" | head -1 | sed 's/^target: *//')
		target=$(echo "$target" | xargs)

		if [[ "$target" != "orchestrator" ]]; then
			target_exists=false
			if [[ -n "${GLOBAL_AGENTS[$target]:-}" ]]; then
				target_exists=true
			fi
			if [[ -f "$AGENTS_SRC/${target}.md" ]]; then
				target_exists=true
			fi

			if [[ "$target_exists" == "false" ]]; then
				log_warn "Overlay targets unknown agent: $target (from $(basename "$overlay_file"))"
				((WARNINGS++))
			fi
		fi
	done
fi

# 9. Check MCP server name conflicts with mcp.json
log_info "Checking MCP server name conflicts..."
if [[ -d "$MCP_SRC" ]]; then
	# Check user-level mcp.json
	USER_MCP="${AGENT_HOME}/mcp.json"
	if [[ -f "$USER_MCP" ]] && command -v jq &> /dev/null; then
		for mcp_file in "$MCP_SRC"/*.mcp.json; do
			[[ -f "$mcp_file" ]] || continue
			name=$(jq -r '.name // empty' "$mcp_file")
			if [[ -n "$name" ]] && jq -e ".mcpServers[\"$name\"]" "$USER_MCP" >/dev/null 2>&1; then
				log_warn "MCP server '$name' also defined in user mcp.json (user config takes precedence)"
				((WARNINGS++))
			fi
		done
	fi

	# Check project-level mcp.json
	PROJECT_MCP="${PROJECT_ROOT}/.pi/mcp.json"
	if [[ -f "$PROJECT_MCP" ]] && command -v jq &> /dev/null; then
		for mcp_file in "$MCP_SRC"/*.mcp.json; do
			[[ -f "$mcp_file" ]] || continue
			name=$(jq -r '.name // empty' "$mcp_file")
			if [[ -n "$name" ]] && jq -e ".mcpServers[\"$name\"]" "$PROJECT_MCP" >/dev/null 2>&1; then
				log_warn "MCP server '$name' also defined in project .pi/mcp.json (project config takes precedence)"
				((WARNINGS++))
			fi
		done
	fi
fi

# 10. Verify extension is installed
log_info "Verifying extension installation..."
EXTENSION_TARGET="${AGENT_HOME_EXTENSIONS}/gentle-agent-extensions.ts"
if [[ -f "$EXTENSION_TARGET" ]]; then
	log_success "Extension found at $EXTENSION_TARGET"
else
	log_error "Extension not installed at $EXTENSION_TARGET"
	log_error "Run install.sh first"
	((ISSUES++))
fi

# Summary
echo ""
log_info "=== Sync Summary ==="
log_info "Changes made: $CHANGES"
log_info "Issues found: $ISSUES"
log_info "Warnings: $WARNINGS"

if [[ "$DRY_RUN" == "true" ]]; then
	log_warn "DRY RUN - no actual changes made"
fi

if [[ "$CHECK_MODE" == "true" ]]; then
	if [[ $ISSUES -gt 0 ]]; then
		log_error "Check failed: $ISSUES issue(s) found"
		exit 1
	else
		log_success "Check passed"
		exit 0
	fi
fi

if [[ $ISSUES -gt 0 ]]; then
	log_error "Sync completed with $ISSUES issue(s)"
	exit 1
fi

log_success "Sync completed successfully"
