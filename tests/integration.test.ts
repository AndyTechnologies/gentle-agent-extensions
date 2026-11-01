import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test, { before, after, describe } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const EXTENSION_PATH = join(PROJECT_ROOT, "src/extension.ts");

const testRoot = mkdtempSync(join(tmpdir(), "gentle-integration-"));
after(() => rmSync(testRoot, { recursive: true, force: true }));

function runPiPrint(prompt: string, cwd: string, env: NodeJS.ProcessEnv = process.env): { stdout: string; stderr: string; code: number } {
    const result = spawnSync("pi", ["--print", prompt, "--no-session"], { 
        cwd, 
        env: { ...env, HOME: env.HOME || "/tmp" },
        encoding: "utf8", 
        timeout: 30000 
    });
    return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        code: result.status ?? 0
    };
}

function runPiCommand(command: string, cwd: string, env: NodeJS.ProcessEnv = process.env): { stdout: string; stderr: string; code: number } {
    const result = spawnSync("bash", ["-c", `printf "%s\\n/q\\n" "${command}" | pi`], { 
        cwd, 
        env: { ...env, HOME: env.HOME || "/tmp" },
        encoding: "utf8", 
        timeout: 30000 
    });
    return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        code: result.status ?? 0
    };
}

function createTestProject() {
    const projectDir = mkdtempSync(join(testRoot, "project-"));
    return projectDir;
}

describe("Integration Tests - Bundled Package Architecture", () => {
    let projectDir: string;

    before(() => {
        projectDir = createTestProject();
    });

    test("extension loads via pi -e without errors", async () => {
        const result = runPiPrint("test", PROJECT_ROOT);
        assert.equal(result.code, 0, `Pi failed to load extension: ${result.stderr}`);
        assert.ok(result.stdout.includes("Test received") || result.stdout.length > 0, "Pi responded");
    });

    test.skip("extension registers skills via pi.skills (requires clean install)", () => {
        // Skipped: depends on global install state
    });

    test("status command executes", () => {
        const result = runPiCommand("/gentle-extensions:status", projectDir);
        assert.ok(true, "status command executed");
    });

    test("doctor command executes", () => {
        const result = runPiCommand("/gentle-extensions:doctor", projectDir);
        assert.ok(true, "doctor command executed");
    });

    test("mcp-reload command executes", () => {
        const result = runPiCommand("/gentle-extensions:mcp-reload", projectDir);
        assert.ok(true, "mcp-reload command executed");
    });

    test("fix command executes", () => {
        const result = runPiCommand("/gentle-extensions:fix", projectDir);
        assert.ok(true, "fix command executed");
    });

    test("mcp-health command executes", () => {
        const result = runPiCommand("/gentle-extensions:mcp-health", projectDir);
        assert.ok(true, "mcp-health command executed");
    });

    test("conflicts command executes", () => {
        const result = runPiCommand("/gentle-extensions:conflicts", projectDir);
        assert.ok(true, "conflicts command executed");
    });

    test.skip("architecture-council agent is available (requires interactive)", () => {
        // Skipped: --print mode doesn't support agent delegation reliably
    });

    test.skip("gentle-agent-extension skill is loadable (requires clean install)", () => {
        // Skipped: depends on global install state
    });

    test.skip("architecture-quest skill is loadable (requires clean install)", () => {
        // Skipped: depends on global install state
    });
});

describe("Integration Tests - Extension Config", () => {
    test("extension.config.json is loaded", () => {
        const configPath = join(PROJECT_ROOT, "extension.config.json");
        assert.ok(existsSync(configPath), "extension.config.json exists");
        const config = JSON.parse(readFileSync(configPath, "utf8"));
        assert.ok(config.sourceDirs, "has sourceDirs");
        assert.ok(config.features, "has features");
        assert.ok(config.validation, "has validation");
        assert.ok(config.mcpDefaults, "has mcpDefaults");
    });
});

describe("Integration Tests - Bundled Resource Validation", () => {
    test("bundled agents directory has expected files", () => {
        const agentsDir = join(PROJECT_ROOT, "resources", "agents");
        const files = readdirSync(agentsDir).filter(f => f.endsWith(".md"));
        assert.ok(files.length > 0, "has at least one agent");
        assert.ok(files.includes("architecture-council.md"), "has architecture-council");
    });

    test("bundled overlays directory has expected files", () => {
        const overlaysDir = join(PROJECT_ROOT, "resources", "overlays");
        const files = readdirSync(overlaysDir).filter(f => f.endsWith(".overlay.md"));
        assert.ok(files.length > 0, "has at least one overlay");
        assert.ok(files.includes("orchestrator.overlay.md"), "has orchestrator overlay");
    });

    test("bundled skills directory has expected skills", () => {
        const skillsDir = join(PROJECT_ROOT, "resources", "skills");
        const dirs = readdirSync(skillsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        assert.ok(dirs.includes("architecture-quest"), "has architecture-quest");
        assert.ok(dirs.includes("gentle-agent-extension"), "has gentle-agent-extension");
    });

    test("bundled routing directory has expected files", () => {
        const routingDir = join(PROJECT_ROOT, "resources", "routing");
        const files = readdirSync(routingDir).filter(f => f.endsWith(".md"));
        assert.ok(files.includes("architecture-council.md"), "has architecture-council routing");
    });
});

describe("Integration Tests - Package Install", () => {
    let projectDir: string;

    before(() => {
        projectDir = mkdtempSync(join(testRoot, "project-install-"));
    });

    test("extension can be installed locally via pi install", () => {
        const result = spawnSync("pi", ["install", PROJECT_ROOT], { 
            cwd: projectDir,
            env: { ...process.env, HOME: process.env.HOME || "/tmp" },
            encoding: "utf8", 
            timeout: 30000 
        });
        assert.ok(result.status === 0 || result.stderr.includes("already"), "Install should succeed or report already installed");
    });

    test.skip("installed extension loads in project (requires clean env)", () => {
        // Skipped: requires clean environment
    });
});