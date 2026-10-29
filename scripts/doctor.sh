#!/usr/bin/env bash
# doctor.sh - Check gentle-agent-extensions installation and compatibility
#
# This script validates the installation, checks for conflicts, and verifies
# compatibility with the current Gentle AI / Gentle Pi versions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_step() { echo -e "${CYAN}▶${NC} $*"; }

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Check gentle-agent-extensions installation, configuration, and compatibility.

Options:
  --profile PROFILE    Installation profile: pi, gentle-shell, gentle-shell-linked (default: pi)
  --agent-home PATH    Explicit agent home directory (overrides profile)
  --verbose            Show detailed output
  -h, --help           Show this help

Examples:
  $0                    # Standard check
  $0 --verbose          # Detailed output
  $0 --profile gentle-shell
EOF
}

PROFILE="pi"
AGENT_HOME=""
VERBOSE=false

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
		--verbose)
			VERBOSE=true
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

if [[ -z "$AGENT_HOME" ]]; then
	case "$PROFILE" in
		pi) AGENT_HOME="${HOME}/.pi/agent" ;;
		gentle-shell) AGENT_HOME="${HOME}/.local/share/gentle-shell/agent" ;;
		gentle-shell-linked) AGENT_HOME="${HOME}/.pi/agent" ;;
		*) log_error "Unknown profile: $PROFILE"; exit 1 ;;
	esac
fi

ISSUES=0
WARNINGS=0
PASSED=0

check_pass() { PASSED=$((PASSED+1)); [[ "$VERBOSE" == "true" ]] && log_success "$1" || true; }
check_warn() { WARNINGS=$((WARNINGS+1)); log_warn "$1"; }
check_fail() { ISSUES=$((ISSUES+1)); log_error "$1"; }

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         gentle-agent-extensions Doctor                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log_info "Profile: $PROFILE"
log_info "Agent home: $AGENT_HOME"
log_info "Project root: $PROJECT_ROOT"
echo ""

# 1. Project structure
log_step "Checking project structure..."

for dir in "agents" "overlays" "routing" "skills" "mcp" "scripts" "extensions" "tests" "docs"; do
	if [[ -d "${PROJECT_ROOT}/${dir}" ]]; then
		check_pass "Directory exists: $dir/"
	else
		check_warn "Directory missing: $dir/"
	fi
done

# 2. Manifest
log_step "Checking manifest..."
MANIFEST="${PROJECT_ROOT}/.manifest.json"
if [[ -f "$MANIFEST" ]]; then
	check_pass "Manifest exists"
	if [[ "$VERBOSE" == "true" ]]; then
		cat "$MANIFEST" | jq . 2>/dev/null || cat "$MANIFEST"
	fi
else
	check_fail "Manifest missing: .manifest.json"
fi

# 3. Extension installation (package or extensions folder)
log_step "Checking extension installation..."
EXTENSION_TARGET="${AGENT_HOME}/extensions/gentle-agent-extensions.ts"
EXTENSION_INSTALLED=false
if [[ -f "$EXTENSION_TARGET" ]]; then
	check_pass "Extension installed at $EXTENSION_TARGET"
	EXTENSION_INSTALLED=true
	if [[ "$VERBOSE" == "true" ]]; then
		head -30 "$EXTENSION_TARGET"
	fi
else
	# Check if registered as package in settings.json
	SETTINGS_JSON="${AGENT_HOME}/settings.json"
	if [[ -f "$SETTINGS_JSON" ]] && grep -q "gentle-agent-extensions" "$SETTINGS_JSON"; then
		check_pass "Extension registered as package in settings.json"
		EXTENSION_INSTALLED=true
	fi
fi
if [[ "$EXTENSION_INSTALLED" == "false" ]]; then
	check_fail "Extension not installed (not in extensions folder or settings.json)"
fi

# 4. Pi / Gentle Pi installation
log_step "Checking Pi / Gentle Pi installation..."

# Check for Pi
if command -v pi &> /dev/null; then
	PI_VERSION=$(pi --version 2>/dev/null || echo "unknown")
	check_pass "Pi found: $PI_VERSION"
else
	check_warn "Pi command not found in PATH"
fi

# Check for gentle-shell
if command -v gentle-shell &> /dev/null; then
	SHELL_VERSION=$(gentle-shell --version 2>/dev/null || echo "unknown")
	check_pass "Gentle Shell found: $SHELL_VERSION"
else
	log_info "Gentle Shell not found (optional)"
fi

# Check gentle-pi package
GENTLE_PI_PATH="${HOME}/.pi/agent/npm/node_modules/gentle-pi"
if [[ -d "$GENTLE_PI_PATH" ]]; then
	GENTLE_PI_VERSION=$(cat "$GENTLE_PI_PATH/package.json" | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
	check_pass "gentle-pi package found: v$GENTLE_PI_VERSION"
else
	check_warn "gentle-pi package not found at $GENTLE_PI_PATH"
fi

# Check gentle-ai package (usually bundled in gentle-pi)
GENTLE_AI_PATH="${HOME}/.pi/agent/npm/node_modules/gentle-ai"
if [[ -d "$GENTLE_AI_PATH" ]]; then
	GENTLE_AI_VERSION=$(cat "$GENTLE_AI_PATH/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "bundled")
	check_pass "gentle-ai package found: v$GENTLE_AI_VERSION"
else
	log_info "gentle-ai package not found separately (may be bundled)"
fi

# 5. Agent home structure
log_step "Checking agent home structure..."
for dir in "agents" "subagents"; do
	dir_path="${AGENT_HOME}/${dir}"
	if [[ -d "$dir_path" ]]; then
		count=$(find "$dir_path" -name "*.md" 2>/dev/null | wc -l)
		check_pass "Global $dir: $dir_path ($count agents)"
	else
		log_info "Global $dir not found (will be created on sync): $dir_path"
	fi
done

# 6. Project agent directory
log_step "Checking project agent directory..."
PROJECT_AGENTS_DIR="${PROJECT_ROOT}/.pi/agents"
if [[ -d "$PROJECT_AGENTS_DIR" ]]; then
	count=$(find "$PROJECT_AGENTS_DIR" -name "*.md" 2>/dev/null | wc -l)
	check_pass "Project agents directory exists ($count agents)"
else
	log_info "Project agents directory not found (will be created on sync)"
fi

# 7. Validate agents
log_step "Validating custom agents..."
AGENTS_SRC="${PROJECT_ROOT}/agents"
if [[ -d "$AGENTS_SRC" ]]; then
	for agent_file in "$AGENTS_SRC"/*.md; do
		[[ -f "$agent_file" ]] || continue
		agent_name=$(basename "$agent_file" .md)

		if head -1 "$agent_file" | grep -q "^---$"; then
			check_pass "Agent $agent_name: has frontmatter"
		else
			check_fail "Agent $agent_name: missing frontmatter delimiter"
			continue
		fi

		if grep -q "^name:" "$agent_file"; then
			check_pass "Agent $agent_name: has name field"
		else
			check_fail "Agent $agent_name: missing 'name' in frontmatter"
		fi

		if grep -q "^description:" "$agent_file"; then
			check_pass "Agent $agent_name: has description"
		else
			check_warn "Agent $agent_name: missing description"
		fi

		body_start=$(grep -n "^---$" "$agent_file" | tail -1 | cut -d: -f1)
		if [[ -n "$body_start" ]]; then
			body_lines=$(( $(wc -l < "$agent_file") - body_start ))
			if [[ $body_lines -gt 1 ]]; then
				check_pass "Agent $agent_name: has instructions ($body_lines lines)"
			else
				check_warn "Agent $agent_name: empty or minimal instructions"
			fi
		fi
	done
else
	log_info "No agents directory found"
fi

# 8. Validate overlays
log_step "Validating overlays..."
OVERLAYS_SRC="${PROJECT_ROOT}/overlays"
if [[ -d "$OVERLAYS_SRC" ]]; then
	for overlay_file in "$OVERLAYS_SRC"/*.overlay.md; do
		[[ -f "$overlay_file" ]] || continue
		overlay_name=$(basename "$overlay_file" .overlay.md)

		if head -1 "$overlay_file" | grep -q "^---$"; then
			check_pass "Overlay $overlay_name: has frontmatter"
		else
			check_fail "Overlay $overlay_name: missing frontmatter"
			continue
		fi

		if grep -q "^target:" "$overlay_file"; then
			target=$(grep "^target:" "$overlay_file" | head -1 | sed 's/^target: *//' | xargs)
			check_pass "Overlay $overlay_name: targets '$target'"
		else
			check_fail "Overlay $overlay_name: missing target"
		fi

		if grep -q "^mode:" "$overlay_file"; then
			mode=$(grep "^mode:" "$overlay_file" | head -1 | sed 's/^mode: *//' | xargs)
			if [[ "$mode" == "append" ]]; then
				check_pass "Overlay $overlay_name: mode=$mode"
			else
				check_warn "Overlay $overlay_name: unknown mode '$mode' (only 'append' supported)"
			fi
		else
			check_pass "Overlay $overlay_name: default mode (append)"
		fi
	done
else
	log_info "No overlays directory found"
fi

# 9. Validate routing
log_step "Validating routing..."
ROUTING_SRC="${PROJECT_ROOT}/routing"
if [[ -d "$ROUTING_SRC" ]]; then
	for routing_file in "$ROUTING_SRC"/*.md; do
		[[ -f "$routing_file" ]] || continue
		routing_name=$(basename "$routing_file" .md)

		if grep -q "^agent:" "$routing_file"; then
			agent=$(grep "^agent:" "$routing_file" | head -1 | sed 's/^agent: *//' | xargs)
			check_pass "Routing $routing_name: delegates to '$agent'"
		else
			check_fail "Routing $routing_name: missing agent"
		fi

		if grep -q "triggers:" "$routing_file"; then
			check_pass "Routing $routing_name: has triggers"
		else
			check_warn "Routing $routing_name: no triggers defined"
		fi
	done
else
	log_info "No routing directory found"
fi

# 10. Validate skills
log_step "Validating skills..."
SKILLS_SRC="${PROJECT_ROOT}/skills"
if [[ -d "$SKILLS_SRC" ]]; then
	for skill_dir in "$SKILLS_SRC"/*/; do
		[[ -d "$skill_dir" ]] || continue
		skill_name=$(basename "$skill_dir")
		skill_file="${skill_dir}SKILL.md"

		if [[ -f "$skill_file" ]]; then
			check_pass "Skill $skill_name: SKILL.md exists"

			missing_sections=()
			for section in "Activation Contract" "Hard Rules" "Decision Gates" "Execution Steps" "Output Contract" "References"; do
				if ! grep -q "^## $section" "$skill_file"; then
					missing_sections+=("$section")
				fi
			done

			if [[ ${#missing_sections[@]} -eq 0 ]]; then
				check_pass "Skill $skill_name: all required sections present"
			else
				check_warn "Skill $skill_name: missing sections: ${missing_sections[*]}"
			fi

			if head -10 "$skill_file" | grep -q "^---$"; then
				if grep -q "^name:" "$skill_file"; then
					fm_name=$(grep "^name:" "$skill_file" | head -1 | sed 's/^name: *//' | xargs)
					if [[ "$fm_name" == "$skill_name" ]]; then
						check_pass "Skill $skill_name: frontmatter name matches directory"
					else
						check_warn "Skill $skill_name: frontmatter name '$fm_name' differs from directory"
					fi
				else
					check_warn "Skill $skill_name: missing name in frontmatter"
				fi
			else
				check_fail "Skill $skill_name: missing frontmatter"
			fi
		else
			check_fail "Skill $skill_name: missing SKILL.md"
		fi
	done
else
	log_info "No skills directory found"
fi

# 11. Validate MCP server definitions
log_step "Validating MCP servers..."
MCP_SRC="${PROJECT_ROOT}/mcp"
if [[ -d "$MCP_SRC" ]]; then
	for mcp_file in "$MCP_SRC"/*.mcp.json; do
		[[ -f "$mcp_file" ]] || continue
		mcp_name=$(basename "$mcp_file" .mcp.json)

		if ! command -v jq &> /dev/null; then
			check_warn "MCP $mcp_name: jq not available, skipping JSON validation"
		else
			if ! jq empty "$mcp_file" 2>/dev/null; then
				check_fail "MCP $mcp_name: invalid JSON syntax"
				continue
			fi

			name=$(jq -r '.name // empty' "$mcp_file")
			description=$(jq -r '.description // empty' "$mcp_file")
			transport=$(jq -r '.transport // empty' "$mcp_file")

			if [[ -z "$name" ]]; then
				check_fail "MCP $mcp_name: missing 'name' field"
			else
				check_pass "MCP $mcp_name: has name field"
			fi
			if [[ -z "$description" ]]; then
				check_fail "MCP $mcp_name: missing 'description' field"
			else
				check_pass "MCP $mcp_name: has description"
			fi
			if [[ -z "$transport" ]]; then
				check_fail "MCP $mcp_name: missing 'transport' field"
			else
				check_pass "MCP $mcp_name: transport=$transport"
			fi

			if [[ "$transport" == "stdio" ]]; then
				command=$(jq -r '.command // empty' "$mcp_file")
				if [[ -z "$command" ]]; then
					check_fail "MCP $mcp_name: stdio transport requires 'command' field"
				else
					check_pass "MCP $mcp_name: has command"
				fi
			elif [[ "$transport" == "http" ]]; then
				url=$(jq -r '.url // empty' "$mcp_file")
				if [[ -z "$url" ]]; then
					check_fail "MCP $mcp_name: http transport requires 'url' field"
				else
					check_pass "MCP $mcp_name: has url"
				fi
			elif [[ -n "$transport" ]]; then
				check_fail "MCP $mcp_name: transport must be 'stdio' or 'http'"
			fi

			if [[ -n "$name" ]] && ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
				check_fail "MCP $mcp_name: name must contain only letters, digits, _, and -"
			else
				check_pass "MCP $mcp_name: name format valid"
			fi

			if command -v jq &> /dev/null; then
				env_keys=$(jq -r '.env | keys[]' "$mcp_file" 2>/dev/null || true)
				for key in $env_keys; do
					value=$(jq -r ".env[\"$key\"]" "$mcp_file")
					if [[ -n "$value" ]] && ! [[ "$value" =~ ^\$\{ ]]; then
						key_lower=$(echo "$key" | tr '[:upper:]' '[:lower:]')
						if [[ "$key_lower" =~ (secret|token|key|password) ]]; then
							check_warn "MCP $mcp_name: env '$key' may contain hardcoded secret (use \${VAR} syntax)"
						fi
					fi
				done
			fi
		fi
	done
else
	log_info "No MCP directory found"
fi

# 12. Check for conflicts
log_step "Checking for conflicts..."

# Global agents
declare -A GLOBAL_AGENTS
for dir in "${AGENT_HOME}/agents" "${AGENT_HOME}/subagents"; do
	if [[ -d "$dir" ]]; then
		for file in "$dir"/*.md; do
			[[ -f "$file" ]] || continue
			name=$(basename "$file" .md)
			GLOBAL_AGENTS["$name"]="$dir"
		done
	fi
done

# Check project agents vs global
if [[ -d "$AGENTS_SRC" ]]; then
	for agent_file in "$AGENTS_SRC"/*.md; do
		[[ -f "$agent_file" ]] || continue
		agent_name=$(basename "$agent_file" .md)
		if [[ -n "${GLOBAL_AGENTS[$agent_name]:-}" ]]; then
			check_warn "Project agent '$agent_name' shadows global agent in ${GLOBAL_AGENTS[$agent_name]}"
		fi
	done
fi

# Check overlay targets
if [[ -d "$OVERLAYS_SRC" ]]; then
	for overlay_file in "$OVERLAYS_SRC"/*.overlay.md; do
		[[ -f "$overlay_file" ]] || continue
		target=$(grep "^target:" "$overlay_file" | head -1 | sed 's/^target: *//' | xargs)
		if [[ "$target" != "orchestrator" ]]; then
			target_exists=false
			if [[ -n "${GLOBAL_AGENTS[$target]:-}" ]]; then target_exists=true; fi
			if [[ -f "$AGENTS_SRC/${target}.md" ]]; then target_exists=true; fi
			if [[ "$target_exists" == "false" ]]; then
				check_warn "Overlay '$(basename "$overlay_file")' targets unknown agent: $target"
			fi
		fi
	done
fi

# 13. Check skill registry
log_step "Checking skill registry..."
REGISTRY="${PROJECT_ROOT}/.atl/skill-registry.md"
if [[ -f "$REGISTRY" ]]; then
	check_pass "Skill registry exists at .atl/skill-registry.md"
	if [[ "$VERBOSE" == "true" ]]; then
		grep -A 5 "^## Skills" "$REGISTRY" | head -20
	fi
else
	log_info "Skill registry not found (will be generated by gentle-pi)"
fi

# 14. Check scripts are executable
log_step "Checking script permissions..."
for script in install.sh sync.sh doctor.sh; do
	script_path="${PROJECT_ROOT}/scripts/${script}"
	if [[ -f "$script_path" ]]; then
		if [[ -x "$script_path" ]]; then
			check_pass "Script executable: $script"
		else
			check_warn "Script not executable: $script (run: chmod +x scripts/$script)"
		fi
	fi
done

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                        Summary                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
log_success "Passed: $PASSED"
log_warn "Warnings: $WARNINGS"
log_error "Issues: $ISSUES"
echo ""

if [[ $ISSUES -gt 0 ]]; then
	log_error "Doctor check FAILED - $ISSUES issue(s) require attention"
	exit 1
elif [[ $WARNINGS -gt 0 ]]; then
	log_warn "Doctor check PASSED with $WARNINGS warning(s)"
	exit 0
else
	log_success "Doctor check PASSED - all checks OK"
	exit 0
fi
