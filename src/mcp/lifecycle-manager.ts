import { spawnSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureDir, getMcpStatePath } from "../core/paths.js";
import { logger } from "../core/logger.js";
import { DEFAULT_LIFECYCLE_CONFIG, type McpManager } from "../core/constants.js";
import type { McpServerDefinition, McpStateEntry, McpHandshakeResult, McpLifecycleConfig } from "./types.js";
import { performMcpHandshake, performHttpMcpHandshake } from "./handshake.js";

export class McpLifecycleManager {
	private config: McpLifecycleConfig;
	private state: Map<string, McpStateEntry> = new Map();
	private projectCwd: string;

	constructor(_extensionName: string, projectCwd: string, config?: Partial<McpLifecycleConfig>) {
		this.projectCwd = projectCwd;
		this.config = { ...DEFAULT_LIFECYCLE_CONFIG, ...config } as McpLifecycleConfig;
	}

	private getStateFilePath(): string {
		return getMcpStatePath(this.projectCwd, this.config.stateFile);
	}

	async loadState(): Promise<void> {
		const statePath = this.getStateFilePath();
		if (!existsSync(statePath)) {
			this.state.clear();
			return;
		}
		try {
			const content = readFileSync(statePath, "utf8");
			const data = JSON.parse(content);
			this.state.clear();
			for (const [name, entry] of Object.entries(data)) {
				this.state.set(name, entry as McpStateEntry);
			}
		} catch (e) {
			logger.warn(`Failed to load MCP state for ${this.projectCwd}: ${e}`);
			this.state.clear();
		}
	}

	async saveState(): Promise<void> {
		const statePath = this.getStateFilePath();
		ensureDir(dirname(statePath));
		const data = Object.fromEntries(this.state);
		writeFileSync(statePath, JSON.stringify(data, null, 2));
	}

	getState(name: string): McpStateEntry | undefined {
		return this.state.get(name);
	}

	getAllStates(): McpStateEntry[] {
		return Array.from(this.state.values());
	}

	async setState(name: string, entry: Partial<McpStateEntry>): Promise<void> {
		const existing = this.state.get(name) || { name, lifecycleState: "not_installed" };
		this.state.set(name, { ...existing, ...entry } as McpStateEntry);
		await this.saveState();
	}

	isAllowed(manager: string, pkg: string): boolean {
		if (!this.config.allowList.managers.includes(manager)) return false;
		const allowedPackages = this.config.allowList.packages[manager] || [];
		if (allowedPackages.includes("*")) return true;
		return allowedPackages.includes(pkg);
	}

	async detectInstalledVersion(manager: McpManager, pkg: string, version?: string): Promise<string | null> {
		let result: { status: number | null; stdout: string | Buffer; stderr: string | Buffer };
		switch (manager) {
			case "npm":
				result = spawnSync("npm", ["list", "-g", `${pkg}@${version || ""}`], { stdio: "pipe", encoding: "utf8" });
				break;
			case "uv":
				result = spawnSync("uv", ["tool", "list"], { encoding: "utf8" });
				if (result.status === 0) {
					const lines = (result.stdout as string).split("\n");
					for (const line of lines) {
						if (line.includes(pkg)) {
							const parts = line.split(/\s+/);
							if (parts.length >= 2) return parts[1];
						}
					}
				}
				return null;
			case "pip":
				result = spawnSync("pip", ["show", pkg], { encoding: "utf8" });
				if (result.status === 0) {
					const match = (result.stdout as string).match(/Version: (\S+)/);
					if (match) return match[1];
				}
				return null;
			case "cargo":
				result = spawnSync("cargo", ["install", "--list"], { encoding: "utf8" });
				if (result.status === 0) {
					const lines = (result.stdout as string).split("\n");
					for (const line of lines) {
						if (line.startsWith(pkg + " ")) {
							const parts = line.split(/\s+/);
							if (parts.length >= 2) return parts[1];
						}
					}
				}
				return null;
			default:
				return null;
		}
		if (result.status === 0 && result.stdout) {
			const match = (result.stdout as string).match(new RegExp(`${pkg}@([^\\s]+)`));
			if (match) return match[1];
		}
		return null;
	}

	async install(server: McpServerDefinition): Promise<boolean> {
		if (!server.install) return false;
		const { manager, package: pkg, version } = server.install;
		if (!this.isAllowed(manager, pkg)) {
			throw new Error(`Manager ${manager} or package ${pkg} not in allowList`);
		}
		await this.setState(pkg, { lifecycleState: "installing" });
		const args: string[] = [];
		switch (manager) {
			case "npm":
				args.push("install", "-g", `${pkg}@${version}`);
				break;
			case "uv":
				args.push("tool", "install", `${pkg}==${version}`);
				break;
			case "pip":
				args.push("install", `${pkg}==${version}`);
				break;
			case "cargo":
				args.push("install", pkg, "--version", version);
				break;
			default:
				return false;
		}
		const result = spawnSync(manager, args, { stdio: "inherit", shell: false });
		if (result.status !== 0) {
			await this.setState(pkg, { lifecycleState: "failed", lastError: `Exit code ${result.status}` });
			return false;
		}
		const installedVersion = await this.detectInstalledVersion(manager, pkg, version);
		await this.setState(pkg, {
			lifecycleState: "available",
			installedVersion: installedVersion ?? undefined,
			installConfig: { package: pkg, version, manager },
		});
		return true;
	}

	async uninstall(pkg: string): Promise<boolean> {
		const entry = this.state.get(pkg);
		if (!entry || !entry.installConfig) return false;
		const { manager } = entry.installConfig;
		let args: string[] = [];
		switch (manager) {
			case "npm":
				args.push("uninstall", "-g", pkg);
				break;
			case "uv":
				args.push("tool", "uninstall", pkg);
				break;
			case "pip":
				args.push("uninstall", pkg);
				break;
			case "cargo":
				args.push("uninstall", pkg);
				break;
			default:
				return false;
		}
		const result = spawnSync(manager, args, { stdio: "inherit", shell: false });
		if (result.status !== 0) return false;
		await this.setState(pkg, { lifecycleState: "not_installed", installedVersion: undefined });
		return true;
	}

	async healthCheck(server: McpServerDefinition): Promise<McpHandshakeResult> {
		let result: McpHandshakeResult;
		if (server.transport === "stdio") {
			const child = spawn(server.command ?? "", server.args || [], {
				stdio: ["pipe", "pipe", "ignore"],
				env: { ...process.env, ...server.env },
				cwd: server.cwd,
			});
			result = await performMcpHandshake(child, server.name, server);
		} else if (server.transport === "http") {
			result = await performHttpMcpHandshake(server);
		} else {
			return { ok: false, error: "Unknown transport" };
		}
		await this.setState(server.name, {
			lifecycleState: result.ok ? "available" : "failed",
			lastHealthCheck: Date.now(),
			lastError: result.error,
		});
		return result;
	}

	async getStatusReport(): Promise<string> {
		const entries = this.getAllStates();
		if (entries.length === 0) return "No MCP servers configured.";
		let report = "MCP Servers Status:\n\n";
		for (const entry of entries) {
			const state = entry.lifecycleState || "unknown";
			const version = entry.installedVersion ? ` v${entry.installedVersion}` : "";
			const health = entry.lastHealthCheck ? ` (last check: ${Math.round((Date.now() - entry.lastHealthCheck) / 1000)}s ago)` : "";
			const error = entry.lastError ? ` - ${entry.lastError}` : "";
			report += `  ${entry.name}${version}: ${state}${health}${error}\n`;
		}
		return report;
	}
}