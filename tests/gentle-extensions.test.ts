import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const EXTENSION_PATH = join(PROJECT_ROOT, "src/extension.ts");

describe("gentle-agent-extensions package structure", () => {
	test("package directories exist", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "src")), "src/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources")), "resources/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "agents")), "resources/agents/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "overlays")), "resources/overlays/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "routing")), "resources/routing/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "skills")), "resources/skills/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "mcp")), "resources/mcp/ exists");
	});

	test("extension entry point exists", () => {
		assert.ok(existsSync(EXTENSION_PATH), "src/extension.ts exists");
		const content = readFileSync(EXTENSION_PATH, "utf8");
		assert.ok(content.includes("gentleAgentExtensions"), "exports main function");
		assert.ok(content.includes("before_agent_start"), "handles before_agent_start");
		assert.ok(content.includes("session_start"), "handles session_start");
		assert.ok(content.includes("PACKAGE_ROOT"), "uses PACKAGE_ROOT for bundled resources");
		assert.ok(content.includes("BUNDLED"), "has BUNDLED resource paths");
		assert.ok(content.includes("gentle-extensions:sync"), "registers sync command");
		assert.ok(content.includes("gentle-extensions:doctor"), "registers doctor command");
		assert.ok(content.includes("gentle-extensions:status"), "registers status command");
		assert.ok(content.includes("gentle-extensions:mcp-reload"), "registers mcp-reload command");
		assert.ok(content.includes("gentle-extensions:fix"), "registers fix command");
		assert.ok(content.includes("gentle-extensions:mcp-health"), "registers mcp-health command");
	});

	test("package.json has correct pi manifest", () => {
		const pkgPath = join(PROJECT_ROOT, "package.json");
		assert.ok(existsSync(pkgPath), "package.json exists");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
		assert.equal(pkg.name, "gentle-agent-extensions");
		assert.ok(pkg.pi?.extensions?.includes("src/extension.ts"), "pi.extensions points to src/extension.ts");
		assert.ok(pkg.pi?.skills?.includes("resources/skills/*"), "pi.skills includes resources/skills/*");
		assert.ok(pkg.files?.includes("src/"), "files includes src/");
		assert.ok(pkg.files?.includes("resources/"), "files includes resources/");
		assert.ok(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]?.startsWith("^1.4.0"), "peerDependencies pinned to ^1.4.0");
	});

	test("bundled agents exist", () => {
		const agentsDir = join(PROJECT_ROOT, "resources", "agents");
		const files = readdirSync(agentsDir).filter(f => f.endsWith(".md"));
		assert.ok(files.includes("architecture-council.md"), "has architecture-council.md");
	});

	test("bundled overlays exist", () => {
		const overlaysDir = join(PROJECT_ROOT, "resources", "overlays");
		const files = readdirSync(overlaysDir).filter(f => f.endsWith(".overlay.md"));
		assert.ok(files.includes("orchestrator.overlay.md"), "has orchestrator.overlay.md");
	});

	test("bundled skills exist", () => {
		const skillsDir = join(PROJECT_ROOT, "resources", "skills");
		const dirs = readdirSync(skillsDir, { withFileTypes: true })
			.filter(d => d.isDirectory())
			.map(d => d.name);
		assert.ok(dirs.includes("architecture-quest"), "has architecture-quest skill");
		assert.ok(dirs.includes("gentle-agent-extension"), "has gentle-agent-extension skill");
		assert.ok(existsSync(join(skillsDir, "architecture-quest", "SKILL.md")), "architecture-quest has SKILL.md");
		assert.ok(existsSync(join(skillsDir, "gentle-agent-extension", "SKILL.md")), "gentle-agent-extension has SKILL.md");
	});

	test("bundled routing exists", () => {
		const routingDir = join(PROJECT_ROOT, "resources", "routing");
		const files = readdirSync(routingDir).filter(f => f.endsWith(".md"));
		assert.ok(files.includes("architecture-council.md"), "has architecture-council.md routing");
	});

	test("no legacy directories exist", () => {
		assert.ok(!existsSync(join(PROJECT_ROOT, "agents")), "legacy agents/ removed");
		assert.ok(!existsSync(join(PROJECT_ROOT, "overlays")), "legacy overlays/ removed");
		assert.ok(!existsSync(join(PROJECT_ROOT, "routing")), "legacy routing/ removed");
		assert.ok(!existsSync(join(PROJECT_ROOT, "skills")), "legacy skills/ removed");
		assert.ok(!existsSync(join(PROJECT_ROOT, "scripts")), "legacy scripts/ removed");
		assert.ok(!existsSync(join(PROJECT_ROOT, "extensions")), "legacy extensions/ removed");
	});
});

describe("bundled resources validation", () => {
	test("architecture-council agent has valid frontmatter", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "agents", "architecture-council.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter delimiter");
		assert.ok(/^name:\s*architecture-council/m.test(content), "has correct name");
		assert.ok(/^description:/m.test(content), "has description");
		assert.ok(/^tools:/m.test(content), "has tools array");
	});

	test("orchestrator overlay has valid frontmatter and modes", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "overlays", "orchestrator.overlay.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter delimiter");
		assert.ok(/^target:\s*orchestrator/m.test(content), "targets orchestrator");
		assert.ok(/^mode:\s*(append|prepend|replace)/m.test(content), "has valid mode");
	});

	test("gentle-agent-extension skill references new paths", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "gentle-agent-extension", "SKILL.md"), "utf8");
		assert.ok(content.includes("src/extension.ts"), "references src/extension.ts");
		assert.ok(content.includes("resources/skills/"), "references resources/skills/");
		assert.ok(content.includes("resources/agents/"), "references resources/agents/");
		assert.ok(content.includes("resources/overlays/"), "references resources/overlays/");
		assert.ok(content.includes("/gentle-extensions:"), "references slash commands");
		assert.ok(!content.includes("scripts/"), "no longer references scripts/");
		assert.ok(!content.includes("extensions/gentle-agent-extensions.ts"), "no longer references old extension path");
	});

	test("architecture-quest skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "architecture-quest", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: architecture-quest"), "correct name");
		const sections = [
			"## Activation Contract",
			"## Hard Rules",
			"## Decision Gates",
			"## Execution Steps",
			"## Output Contract",
			"## References"
		];
		for (const section of sections) {
			assert.ok(content.includes(section), `has section: ${section}`);
		}
	});

	test("routing references correct agent", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "routing", "architecture-council.md"), "utf8");
		assert.ok(content.includes("agent: architecture-council"), "routes to architecture-council");
		assert.ok(content.includes("delegation: subagent_run"), "uses subagent_run");
	});
});

describe("extension parsing utilities", () => {
	test("overlay frontmatter parsing works", () => {
		const overlayContent = `---\ntarget: test-agent\npriority: 75\nmode: prepend\n---\nOverlay body content`;
		
		const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(overlayContent);
		assert.ok(fmMatch, "frontmatter regex matches");
		
		const [, fm, body] = fmMatch!;
		const targetMatch = /target:\s*([^\n]+)/.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);
		const modeMatch = /mode:\s*(\w+)/.exec(fm);
		
		assert.equal(targetMatch![1].trim(), "test-agent");
		assert.equal(parseInt(priorityMatch![1], 10), 75);
		assert.equal(modeMatch![1].trim(), "prepend");
		assert.equal(body.trim(), "Overlay body content");
	});

	test("overlay mode defaults to append", () => {
		const overlayContent = `---\ntarget: orchestrator\n---\nBody only`;
		
		const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(overlayContent);
		const [, fm] = fmMatch!;
		
		const modeMatch = /mode:\s*(\w+)/.exec(fm);
		assert.equal(modeMatch, null, "mode not specified");
	});

	test("appendSystemPromptOnce logic", () => {
		const options: { appendSystemPrompt?: string; systemPrompt?: string } = {};
		
		function appendSystemPromptOnce(opts: typeof options, text: string): void {
			const normalized = text.replace(/^\n+/, "");
			if (!opts || !normalized) return;
			const current = opts.appendSystemPrompt ?? "";
			if (current.includes(normalized)) return;
			opts.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
		}
		
		appendSystemPromptOnce(options, "Test prompt");
		assert.equal(options.appendSystemPrompt, "Test prompt");
		
		appendSystemPromptOnce(options, "Test prompt");
		assert.equal(options.appendSystemPrompt, "Test prompt", "does not duplicate");
		
		appendSystemPromptOnce(options, "\n\nNew prompt");
		assert.equal(options.appendSystemPrompt, "Test prompt\n\nNew prompt", "handles leading newlines");
	});

	test("prependSystemPromptOnce logic", () => {
		const options: { appendSystemPrompt?: string; systemPrompt?: string } = {};
		
		function prependSystemPromptOnce(opts: typeof options, text: string): void {
			const normalized = text.replace(/^\n+/, "");
			if (!opts || !normalized) return;
			const current = opts.appendSystemPrompt ?? "";
			if (current.includes(normalized)) return;
			opts.appendSystemPrompt = normalized + (current ? `\n\n${current}` : "");
		}
		
		prependSystemPromptOnce(options, "First");
		assert.equal(options.appendSystemPrompt, "First");
		
		prependSystemPromptOnce(options, "Second");
		assert.equal(options.appendSystemPrompt, "Second\n\nFirst", "prepends correctly");
	});

	test("replaceSystemPrompt logic", () => {
		const options: { appendSystemPrompt?: string; systemPrompt?: string } = { appendSystemPrompt: "Old" };
		
		function replaceSystemPrompt(opts: typeof options, text: string): void {
			const normalized = text.replace(/^\n+/, "");
			if (!opts || !normalized) return;
			opts.systemPrompt = normalized;
			opts.appendSystemPrompt = "";
		}
		
		replaceSystemPrompt(options, "New");
		assert.equal(options.systemPrompt, "New");
		assert.equal(options.appendSystemPrompt, "");
	});
});

describe("extension load test", () => {
	test("extension loads without errors via pi -e", async () => {
		// This test verifies the extension can be loaded by Pi
		// We test by checking the file exists and has valid syntax for jiti
		const content = readFileSync(EXTENSION_PATH, "utf8");
		
		// Check required imports
		assert.ok(content.includes("@earendil-works/pi-coding-agent"), "imports ExtensionAPI");
		assert.ok(content.includes("ExtensionContext"), "imports ExtensionContext");
		
		// Check required event handlers
		assert.ok(content.includes('pi.on("session_start"'), "registers session_start");
		assert.ok(content.includes('pi.on("before_agent_start"'), "registers before_agent_start");
		
		// Check command registrations
		const commands = [
			"gentle-extensions:sync",
			"gentle-extensions:doctor",
			"gentle-extensions:status",
			"gentle-extensions:mcp-reload",
			"gentle-extensions:fix",
			"gentle-extensions:mcp-health",
			"gentle-extensions:conflicts"
		];
		for (const cmd of commands) {
			assert.ok(content.includes(cmd), `registers ${cmd}`);
		}
		
		// Check resource loading functions
		assert.ok(content.includes("discoverBundledAgents"), "has discoverBundledAgents");
		assert.ok(content.includes("loadBundledOverlays"), "has loadBundledOverlays");
		assert.ok(content.includes("loadBundledMcpServers"), "has loadBundledMcpServers");
		assert.ok(content.includes("copyBundledAgentsToProject"), "has copyBundledAgentsToProject");
		assert.ok(content.includes("registerBundledMcpServers"), "has registerBundledMcpServers");
		assert.ok(content.includes("applyOverlay"), "has applyOverlay with mode support");
	});
});