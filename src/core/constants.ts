export const EXTENSION_NAME = "gentle-agent-extensions";

export const OVERLAY_MODES = ["append", "prepend", "replace"] as const;
export type OverlayMode = (typeof OVERLAY_MODES)[number];

export const MCP_TRANSPORTS = ["stdio", "http"] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

export const MCP_EXPOSURES = ["codemode", "direct", "deferred", "hidden"] as const;
export type McpExposure = (typeof MCP_EXPOSURES)[number];

export const MCP_AUTH_TYPES = ["oauth", "bearer", "none"] as const;
export type McpAuthType = (typeof MCP_AUTH_TYPES)[number];

export const DELEGATION_TYPES = ["subagent_run", "subagent_run_background"] as const;
export type DelegationType = (typeof DELEGATION_TYPES)[number];

export const ALLOWED_MCP_MANAGERS = ["npm", "uv", "pip", "cargo"] as const;
export type McpManager = (typeof ALLOWED_MCP_MANAGERS)[number];

export const MCP_LIFECYCLE_STATES = [
	"available",
	"disabled",
	"failed",
	"not_installed",
	"installing",
	"updating",
] as const;
export type McpLifecycleState = (typeof MCP_LIFECYCLE_STATES)[number];

export const DEFAULT_MCP_TIMEOUT = 60;
export const MCP_HANDSHAKE_TIMEOUT = 10000;
export const MCP_HTTP_TIMEOUT = 5000;
export const MCP_INIT_RETRY_DELAY = 2000;

export const DEFAULT_LIFECYCLE_CONFIG = {
	autoInstall: false,
	allowList: {
		managers: ALLOWED_MCP_MANAGERS,
		packages: {
			npm: ["*"],
			uv: ["*"],
			pip: ["*"],
			cargo: ["*"],
		},
	},
	stateFile: ".gentle-agent-extensions/mcp-state.json",
} as const;