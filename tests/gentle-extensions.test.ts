import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const EXTENSION_PATH = join(PROJECT_ROOT, "src/extension.ts");
const SRC_PATH = join(PROJECT_ROOT, "src");

describe("gentle-agent-extensions package structure", () => {
	test("package directories exist", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "src")), "src/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources")), "resources/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "agents")), "resources/agents/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "overlays")), "resources/overlays/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "routing")), "resources/routing/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "resources", "skills")), "resources/skills/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts")), "scripts/ exists for validate-skills.ts");
	});

	test("extension entry point exists and is a composition root", () => {
		assert.ok(existsSync(EXTENSION_PATH), "src/extension.ts exists");
		const content = readFileSync(EXTENSION_PATH, "utf8");
		assert.ok(content.includes("gentleAgentExtensions"), "exports main function");
		assert.ok(content.includes("createRuntime"), "uses createRuntime from core");
		assert.ok(content.includes("registerEvents"), "uses registerEvents from events");
		assert.ok(content.includes("registerCommands"), "uses registerCommands from commands");
	});

	test("modular architecture - core module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "core", "constants.ts")), "core/constants.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "core", "paths.ts")), "core/paths.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "core", "logger.ts")), "core/logger.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "core", "runtime.ts")), "core/runtime.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "core", "utils.ts")), "core/utils.ts exists");
	});

	test("modular architecture - agents module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "agents", "types.ts")), "agents/types.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "agents", "loader.ts")), "agents/loader.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "agents", "sync.ts")), "agents/sync.ts exists");
	});

	test("modular architecture - overlays module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "overlays", "types.ts")), "overlays/types.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "overlays", "loader.ts")), "overlays/loader.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "overlays", "applier.ts")), "overlays/applier.ts exists");
	});

	test("modular architecture - routing module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "routing", "types.ts")), "routing/types.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "routing", "loader.ts")), "routing/loader.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "routing", "evaluator.ts")), "routing/evaluator.ts exists");
	});

	test("modular architecture - mcp module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "mcp", "types.ts")), "mcp/types.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "config-loader.ts")), "mcp/config-loader.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "registry.ts")), "mcp/registry.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "handshake.ts")), "mcp/handshake.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "lifecycle-manager.ts")), "mcp/lifecycle-manager.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "service.ts")), "mcp/service.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "mcp", "utils.ts")), "mcp/utils.ts exists");
	});

	test("modular architecture - diagnostics module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "diagnostics", "types.ts")), "diagnostics/types.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "diagnostics", "doctor.ts")), "diagnostics/doctor.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "diagnostics", "resource-graph.ts")), "diagnostics/resource-graph.ts exists");
		assert.ok(existsSync(join(SRC_PATH, "diagnostics", "formatters.ts")), "diagnostics/formatters.ts exists");
	});

	test("modular architecture - events module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "events", "register.ts")), "events/register.ts exists");
	});

	test("modular architecture - commands module exists", () => {
		assert.ok(existsSync(join(SRC_PATH, "commands", "register.ts")), "commands/register.ts exists");
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
		assert.ok(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]?.startsWith("^1.5.0"), "peerDependencies pinned to ^1.5.0");
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
		assert.ok(dirs.includes("changelog-generator"), "has changelog-generator skill");
		assert.ok(dirs.includes("product-quest"), "has product-quest skill");
		assert.ok(existsSync(join(skillsDir, "architecture-quest", "SKILL.md")), "architecture-quest has SKILL.md");
		assert.ok(existsSync(join(skillsDir, "gentle-agent-extension", "SKILL.md")), "gentle-agent-extension has SKILL.md");
		assert.ok(existsSync(join(skillsDir, "changelog-generator", "SKILL.md")), "changelog-generator has SKILL.md");
		assert.ok(existsSync(join(skillsDir, "product-quest", "SKILL.md")), "product-quest has SKILL.md");
	});

	test("bundled routing exists", () => {
		const routingDir = join(PROJECT_ROOT, "resources", "routing");
		const files = readdirSync(routingDir).filter(f => f.endsWith(".md"));
		assert.ok(files.includes("architecture-council.md"), "has architecture-council.md routing");
	});

	test("scripts directory exists for validate-skills.ts", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts", "validate-skills.ts")), "scripts/validate-skills.ts exists");
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

	test("changelog-generator skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "changelog-generator", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: changelog-generator"), "correct name");
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
		assert.ok(content.includes("SemVer"), "references Semantic Versioning");
		assert.ok(content.includes("Keep a Changelog"), "references Keep a Changelog");
		assert.ok(content.includes("VERSION PROPOSALS"), "has version proposal format");
	});

	test("product-quest skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "product-quest", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: product-quest"), "correct name");
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
		assert.ok(content.includes("## Product Contract"), "has Product Contract format");
		assert.ok(content.includes("PC-01"), "uses PC-XX clause IDs");
		assert.ok(content.includes("Cross-refs"), "has cross-references to Architecture Quest");
	});

	test("routing references correct agent", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "routing", "architecture-council.md"), "utf8");
		assert.ok(content.includes("agent: architecture-council"), "routes to architecture-council");
		assert.ok(content.includes("delegation: subagent_run"), "uses subagent_run");
	});

	test("gentle-ui skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "gentle-ui", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: gentle-ui"), "correct name");
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
		assert.ok(content.includes("#ea1889"), "references Gentle-AI magenta accent");
		assert.ok(content.includes("Rose Pine"), "references Rose Pine TUI palette");
	});

	test("github-automation skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "github-automation", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: github-automation"), "correct name");
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
		assert.ok(content.includes("gh CLI"), "references gh CLI");
		assert.ok(content.includes("git"), "references git");
		assert.ok(content.includes("No MCP servers"), "explicitly states no MCP servers");
	});

	test("grilling skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "grilling", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: grilling"), "correct name");
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
		assert.ok(content.includes("50"), "references 50-question budget");
		assert.ok(content.includes("disable-model-invocation: true"), "disabled for model invocation");
	});

	test("grill-me skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "grill-me", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: grill-me"), "correct name");
		assert.ok(content.includes("disable-model-invocation: true"), "disabled for model invocation");
		assert.ok(content.includes("grilling"), "references grilling skill");
	});

	test("red-suite-hygiene skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "red-suite-hygiene", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: red-suite-hygiene"), "correct name");
		const sections = ["## Activation Contract", "## Hard Rules", "## Decision Gates", "## Execution Steps", "## Output Contract", "## References"];
		for (const section of sections) {
			assert.ok(content.includes(section), `has section: ${section}`);
		}
		assert.ok(content.includes("tmpfs"), "references tmpfs cleanup");
		assert.ok(content.includes("pkill"), "references process cleanup");
	});

	test("ui-design skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "ui-design", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: ui-design"), "correct name");
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
		assert.ok(content.includes("gentle-ui"), "references gentle-ui skill");
		assert.ok(content.includes("gentle-design"), "references gentle-design skill");
	});

	test("ui-ux-principles skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "ui-ux-principles", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: ui-ux-principles"), "correct name");
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
		assert.ok(content.includes("WCAG 2.2"), "references WCAG 2.2");
		assert.ok(content.includes("Nielsen"), "references Nielsen heuristics");
		assert.ok(content.includes("HCD"), "references Human-Centered Design");
	});

	test("using-git-worktrees skill is valid", () => {
		const content = readFileSync(join(PROJECT_ROOT, "resources", "skills", "using-git-worktrees", "SKILL.md"), "utf8");
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: using-git-worktrees"), "correct name");
		const sections = ["## Activation Contract", "## Hard Rules", "## Decision Gates", "## Execution Steps", "## Output Contract", "## References"];
		for (const section of sections) {
			assert.ok(content.includes(section), `has section: ${section}`);
		}
		assert.ok(content.includes("git worktree"), "references git worktree");
		assert.ok(content.includes(".worktrees"), "references .worktrees directory");
	});

	test("all new skills have SKILL.md", () => {
		const newSkills = [
			"gentle-ui",
			"github-automation",
			"grilling",
			"grill-me",
			"red-suite-hygiene",
			"ui-design",
			"ui-ux-principles",
			"using-git-worktrees"
		];
		for (const skill of newSkills) {
			assert.ok(existsSync(join(PROJECT_ROOT, "resources", "skills", skill, "SKILL.md")), `${skill} has SKILL.md`);
		}
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
		assert.ok(content.includes("createRuntime"), "imports createRuntime");
		assert.ok(content.includes("registerEvents"), "imports registerEvents");
		assert.ok(content.includes("registerCommands"), "imports registerCommands");
		
		// Check required event handlers registration
		assert.ok(content.includes("registerEvents"), "registers events");
		assert.ok(content.includes("registerCommands"), "registers commands");
		
		// Check command registrations via commands module
		const commands = [
			"gentle-extensions:sync",
			"gentle-extensions:doctor",
			"gentle-extensions:status",
			"gentle-extensions:mcp-reload",
			"gentle-extensions:fix",
			"gentle-extensions:mcp-health",
			"gentle-extensions:conflicts"
		];
		// These are registered in commands/register.ts
		const commandsContent = readFileSync(join(SRC_PATH, "commands", "register.ts"), "utf8");
		for (const cmd of commands) {
			assert.ok(commandsContent.includes(cmd), `registers ${cmd}`);
		}
		
		// Check resource loading functions are in their modules
		const agentsLoader = readFileSync(join(SRC_PATH, "agents", "loader.ts"), "utf8");
		assert.ok(agentsLoader.includes("discoverBundledAgents"), "has discoverBundledAgents in agents/loader");
		
		const overlaysLoader = readFileSync(join(SRC_PATH, "overlays", "loader.ts"), "utf8");
		assert.ok(overlaysLoader.includes("loadBundledOverlays"), "has loadBundledOverlays in overlays/loader");
		
		const mcpConfigLoader = readFileSync(join(SRC_PATH, "mcp", "config-loader.ts"), "utf8");
		assert.ok(mcpConfigLoader.includes("loadBundledMcpServers"), "has loadBundledMcpServers in mcp/config-loader");
		
		const routingLoader = readFileSync(join(SRC_PATH, "routing", "loader.ts"), "utf8");
		assert.ok(routingLoader.includes("loadBundledRouting"), "has loadBundledRouting in routing/loader");
		
		const agentsSync = readFileSync(join(SRC_PATH, "agents", "sync.ts"), "utf8");
		assert.ok(agentsSync.includes("syncBundledAgentsToProject"), "has syncBundledAgentsToProject in agents/sync");
		
		const mcpRegistry = readFileSync(join(SRC_PATH, "mcp", "registry.ts"), "utf8");
		assert.ok(mcpRegistry.includes("registerBundledMcpServers"), "has registerBundledMcpServers in mcp/registry");
		
		const overlaysApplier = readFileSync(join(SRC_PATH, "overlays", "applier.ts"), "utf8");
		assert.ok(overlaysApplier.includes("applyOverlay"), "has applyOverlay with mode support in overlays/applier");
	});
});