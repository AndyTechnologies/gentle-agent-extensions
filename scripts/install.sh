#!/usr/bin/env bash
# install.sh - Install gentle-agent-extensions
#
# This script sets up the project and configures the Pi extension.
# It supports multiple installation profiles:
#   - pi (default): Standard Pi installation at ~/.pi/agent
#   - gentle-shell: Isolated Gentle Shell at ~/.local/share/gentle-shell/agent
#   - gentle-shell-linked: Gentle Shell with --link at ~/.pi/agent

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Install gentle-agent-extensions for Pi / Gentle Pi.

Options:
  --profile PROFILE    Installation profile: pi, gentle-shell, gentle-shell-linked (default: pi)
  --agent-home PATH    Explicit agent home directory (overrides profile)
  --dry-run            Show what would be done without making changes
  --force              Overwrite existing extension file
  -h, --help           Show this help

Examples:
  $0                              # Install for standard Pi
  $0 --profile gentle-shell       # Install for isolated Gentle Shell
  $0 --agent-home ~/.pi/agent     # Explicit agent home
  $0 --dry-run                    # Preview changes
EOF
}

PROFILE="pi"
AGENT_HOME=""
DRY_RUN=false
FORCE=false

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
		--force)
			FORCE=true
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

# Determine agent home based on profile
if [[ -z "$AGENT_HOME" ]]; then
	case "$PROFILE" in
		pi)
			AGENT_HOME="${HOME}/.pi/agent"
			;;
		gentle-shell)
			AGENT_HOME="${HOME}/.local/share/gentle-shell/agent"
			;;
		gentle-shell-linked)
			AGENT_HOME="${HOME}/.pi/agent"
			;;
		*)
			log_error "Unknown profile: $PROFILE"
			exit 1
			;;
	esac
fi

EXTENSION_SOURCE="${PROJECT_ROOT}/extensions/gentle-agent-extensions.ts"
EXTENSION_TARGET="${AGENT_HOME}/extensions/gentle-agent-extensions.ts"

log_info "Installing gentle-agent-extensions"
log_info "Profile: $PROFILE"
log_info "Agent home: $AGENT_HOME"
log_info "Project root: $PROJECT_ROOT"

if [[ "$DRY_RUN" == "true" ]]; then
	log_warn "DRY RUN - no changes will be made"
fi

# Check source extension exists
if [[ ! -f "$EXTENSION_SOURCE" ]]; then
	log_error "Extension source not found: $EXTENSION_SOURCE"
	exit 1
fi

# Create agent home extensions directory
if [[ "$DRY_RUN" == "false" ]]; then
	mkdir -p "$(dirname "$EXTENSION_TARGET")"
fi

# Check if extension already exists
if [[ -f "$EXTENSION_TARGET" && "$FORCE" == "false" && "$DRY_RUN" == "false" ]]; then
	log_warn "Extension already exists at $EXTENSION_TARGET"
	log_warn "Use --force to overwrite or remove it first"
	exit 1
fi

# Copy extension
if [[ "$DRY_RUN" == "true" ]]; then
	log_info "Would copy: $EXTENSION_SOURCE -> $EXTENSION_TARGET"
else
	cp "$EXTENSION_SOURCE" "$EXTENSION_TARGET"
	log_success "Extension installed to $EXTENSION_TARGET"
fi

# Create project agent directories
PROJECT_AGENTS_DIR="${PROJECT_ROOT}/.pi/agents"
PROJECT_SUBAGENTS_DIR="${PROJECT_ROOT}/.pi/subagents"

if [[ "$DRY_RUN" == "true" ]]; then
	log_info "Would create directories: $PROJECT_AGENTS_DIR, $PROJECT_SUBAGENTS_DIR"
else
	mkdir -p "$PROJECT_AGENTS_DIR" "$PROJECT_SUBAGENTS_DIR"
	log_success "Created project agent directories"
fi

# Initialize manifest if not exists
MANIFEST="${PROJECT_ROOT}/.manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
	if [[ "$DRY_RUN" == "true" ]]; then
		log_info "Would create manifest: $MANIFEST"
	else
		cat > "$MANIFEST" <<MANIFEST_EOF
{
  "version": "1.0",
  "description": "Manifest of files managed by gentle-agent-extensions",
  "managedPaths": {
    "extensions": ["extensions/gentle-agent-extensions.ts"],
    "agents": [],
    "routing": [],
    "overlays": [],
    "skills": [],
    "scripts": [],
    "assets": []
  },
  "installProfiles": {
    "$PROFILE": { "agentHome": "$AGENT_HOME" }
  }
}
MANIFEST_EOF
		log_success "Created manifest: $MANIFEST"
	fi
else
	log_info "Manifest already exists: $MANIFEST"
fi

# Add extension to Pi settings if not already present
SETTINGS_FILE="${AGENT_HOME}/settings.json"
if [[ "$DRY_RUN" == "false" ]]; then
	if [[ -f "$SETTINGS_FILE" ]]; then
		# Check if extension is already in settings
		if ! grep -q "gentle-agent-extensions" "$SETTINGS_FILE"; then
			log_warn "Extension not in Pi settings. Add it manually or run:"
			log_warn "  pi install file:$PROJECT_ROOT"
			log_warn "Or add to $SETTINGS_FILE:"
			log_warn '  { "packages": [{ "source": "file:'"$PROJECT_ROOT"'" }] }'
		else
			log_success "Extension already configured in Pi settings"
		fi
	else
		log_warn "Pi settings not found at $SETTINGS_FILE"
		log_warn "Run 'pi install file:$PROJECT_ROOT' to register the extension"
	fi
fi

log_success "Installation complete!"
log_info ""
log_info "Next steps:"
log_info "  1. Register the extension with Pi: pi install file:$PROJECT_ROOT"
log_info "  2. Run sync: $PROJECT_ROOT/scripts/sync.sh"
log_info "  3. Verify: $PROJECT_ROOT/scripts/doctor.sh"
log_info "  4. Start Pi and run /gentle-extensions:status"