import type { McpTransport } from "../core/constants.js";

export interface McpInstallConfig {
	package: string;
	version: string;
	manager: string;
}

export interface McpAuthConfig {
	type: "oauth" | "bearer" | "none";
	envVar?: string;
	description?: string;
}

export interface McpServerDefinition {
	name: string;
	description: string;
	transport: McpTransport;
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	cwd?: string;
	exposure?: "codemode" | "direct" | "deferred" | "hidden";
	toolExposure?: Record<string, string>;
	enabled?: boolean;
	timeout?: number;
	install?: McpInstallConfig;
	auth?: McpAuthConfig;
	headers?: Record<string, string>;
	oauth?: Record<string, unknown>;
	capabilities?: string[];
	agentDependencies?: string[];
	// Lifecycle state (populated from persistent state)
	lifecycleState?: "available" | "disabled" | "failed" | "not_installed" | "installing" | "updating";
	installedVersion?: string;
	lastHealthCheck?: number;
	lastError?: string;
}

export interface McpHandshakeResult {
	ok: boolean;
	error?: string;
	latencyMs?: number;
}

export interface McpStateEntry {
	name: string;
	lifecycleState: "available" | "disabled" | "failed" | "not_installed" | "installing" | "updating";
	installedVersion?: string;
	lastHealthCheck?: number;
	lastError?: string;
	installConfig?: McpInstallConfig;
}

export interface McpLifecycleConfig {
	autoInstall: boolean;
	allowList: {
		managers: string[];
		packages: Record<string, string[]>;
	};
	stateFile: string;
}