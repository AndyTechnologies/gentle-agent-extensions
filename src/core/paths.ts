import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, "..", "..");

export const BUNDLED = {
	agents: join(PACKAGE_ROOT, "resources", "agents"),
	overlays: join(PACKAGE_ROOT, "resources", "overlays"),
	routing: join(PACKAGE_ROOT, "resources", "routing"),
	mcp: join(PACKAGE_ROOT, "resources", "mcp"),
	skills: join(PACKAGE_ROOT, "resources", "skills"),
};

// Re-export fs functions for convenience
export { join, resolve, dirname, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync };

export function getAgentHome(env: NodeJS.ProcessEnv = process.env): string {
	if (env["GENTLE_PI_AGENT_HOME"]) return resolve(env["GENTLE_PI_AGENT_HOME"]!);
	if (env["PI_CODING_AGENT_DIR"]) return resolve(env["PI_CODING_AGENT_DIR"]!);
	return join(homedir(), ".pi", "agent");
}

export function getProjectAgentDir(cwd: string): string {
	return join(cwd, ".pi", "agents");
}

export function getMcpStatePath(cwd: string, stateFile: string): string {
	return join(cwd, stateFile);
}

export function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}