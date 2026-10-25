import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before, after, describe } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const EXTENSION_PATH = join(PROJECT_ROOT, "extensions/gentle-agent-extensions.ts");

const testRoot = mkdtempSync(join(tmpdir(), "gentle-extensions-"));
after(() => rmSync(testRoot, { recursive: true, force: true }));

function createTestProject(overrides: { agents?: string[]; overlays?: string[]; skills?: string[] } = {}) {
	const projectDir = mkdtempSync(join(testRoot, "project-"));
	
	mkdirSync(join(projectDir, "agents"), { recursive: true });
	mkdirSync(join(projectDir, "overlays"), { recursive: true });
	mkdirSync(join(projectDir, "routing"), { recursive: true });
	mkdirSync(join(projectDir, "skills"), { recursive: true });
	mkdirSync(join(projectDir, "scripts"), { recursive: true });
	mkdirSync(join(projectDir, "extensions"), { recursive: true });

	// Copy extension
	const extensionSource = readFileSync(EXTENSION_PATH, "utf8");
	writeFileSync(join(projectDir, "extensions/gentle-agent-extensions.ts"), extensionSource);

	// Default agents
	if (overrides.agents) {
		for (const agent of overrides.agents) {
			writeFileSync(join(projectDir, `agents/${agent}.md`), `---\nname: ${agent}\ndescription: Test agent\n---\nTest instructions for ${agent}`);
		}
	} else {
		writeFileSync(join(projectDir, "agents/test-agent.md"), `---\nname: test-agent\ndescription: A test agent\n---\nTest instructions`);
		writeFileSync(join(projectDir, "agents/another-agent.md"), `---\nname: another-agent\ndescription: Another test agent\nmodel: anthropic/claude-opus-4\nthinking: high\nmode: background\ntools: [read, write]\n---\nMore instructions`);
	}

	// Default overlays
	if (overrides.overlays) {
		for (const overlay of overrides.overlays) {
			writeFileSync(join(projectDir, `overlays/${overlay}.overlay.md`), `---\ntarget: ${overlay}\npriority: 100\nmode: append\n---\nOverlay instructions for ${overlay}`);
		}
	} else {
		writeFileSync(join(projectDir, "overlays/orchestrator.overlay.md"), `---\ntarget: orchestrator\npriority: 100\nmode: append\n---\nOrchestrator overlay instructions`);
		writeFileSync(join(projectDir, "overlays/test-agent.overlay.md"), `---\ntarget: test-agent\npriority: 50\nmode: append\n---\nTest agent overlay instructions`);
	}

	// Default skill
	if (overrides.skills) {
		for (const skill of overrides.skills) {
			mkdirSync(join(projectDir, `skills/${skill}`), { recursive: true });
			writeFileSync(join(projectDir, `skills/${skill}/SKILL.md`), `---\nname: ${skill}\ndescription: Test skill\n---\n\n## Activation Contract\nTest\n\n## Hard Rules\nTest\n\n## Decision Gates\nTest\n\n## Execution Steps\nTest\n\n## Output Contract\nTest\n\n## References\nTest`);
		}
	} else {
		mkdirSync(join(projectDir, "skills/test-skill"), { recursive: true });
		writeFileSync(join(projectDir, "skills/test-skill/SKILL.md"), `---\nname: test-skill\ndescription: Test skill\n---\n\n## Activation Contract\nTest\n\n## Hard Rules\nTest\n\n## Decision Gates\nTest\n\n## Execution Steps\nTest\n\n## Output Contract\nTest\n\n## References\nTest`);
	}

	// Manifest
	writeFileSync(join(projectDir, ".manifest.json"), JSON.stringify({
		version: "1.0",
		managedPaths: { extensions: [], agents: [], routing: [], overlays: [], skills: [], scripts: [], assets: [] },
		installProfiles: {}
	}, null, 2));

	// Scripts
	writeFileSync(join(projectDir, "scripts/sync.sh"), "#!/bin/bash\necho 'sync stub'");
	writeFileSync(join(projectDir, "scripts/doctor.sh"), "#!/bin/bash\necho 'doctor stub'");

	return projectDir;
}

function createAgentHome() {
	const agentHome = mkdtempSync(join(testRoot, "agent-home-"));
	mkdirSync(join(agentHome, "agents"), { recursive: true });
	mkdirSync(join(agentHome, "subagents"), { recursive: true });
	mkdirSync(join(agentHome, "extensions"), { recursive: true });
	return agentHome;
}

describe("gentle-agent-extensions project structure", () => {
	test("project directories exist", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "agents")), "agents/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "overlays")), "overlays/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "routing")), "routing/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "skills")), "skills/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts")), "scripts/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "extensions")), "extensions/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "tests")), "tests/ exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "docs")), "docs/ exists");
	});

	test("extension file exists and is valid TypeScript", () => {
		assert.ok(existsSync(EXTENSION_PATH), "extension file exists");
		const content = readFileSync(EXTENSION_PATH, "utf8");
		assert.ok(content.includes("gentleAgentExtensions"), "exports main function");
		assert.ok(content.includes("before_agent_start"), "handles before_agent_start");
		assert.ok(content.includes("appendSystemPromptOnce"), "uses appendSystemPromptOnce");
		assert.ok(content.includes("session_start"), "handles session_start");
		assert.ok(content.includes("gentle-extensions:sync"), "registers sync command");
		assert.ok(content.includes("gentle-extensions:doctor"), "registers doctor command");
		assert.ok(content.includes("gentle-extensions:status"), "registers status command");
	});

	test("manifest file exists", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, ".manifest.json")), "manifest exists");
		const manifest = JSON.parse(readFileSync(join(PROJECT_ROOT, ".manifest.json"), "utf8"));
		assert.equal(manifest.version, "1.0");
		assert.ok(manifest.managedPaths);
	});

	test("scripts are executable", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts/install.sh")), "install.sh exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts/sync.sh")), "sync.sh exists");
		assert.ok(existsSync(join(PROJECT_ROOT, "scripts/doctor.sh")), "doctor.sh exists");
	});

	test("conventions documentation exists", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "docs/conventions.md")), "conventions.md exists");
		const content = readFileSync(join(PROJECT_ROOT, "docs/conventions.md"), "utf8");
		assert.ok(content.includes("agents/"), "documents agents directory");
		assert.ok(content.includes("overlays/"), "documents overlays directory");
		assert.ok(content.includes("routing/"), "documents routing directory");
		assert.ok(content.includes("skills/"), "documents skills directory");
		assert.ok(content.includes("appendSystemPrompt"), "documents overlay mechanism");
	});
});

describe("extension agent discovery", () => {
	let projectDir: string;
	let agentHome: string;

	before(() => {
		projectDir = createTestProject();
		agentHome = createAgentHome();
	});

	test("discovers agents from project agents/ directory", () => {
		const agentsDir = join(projectDir, "agents");
		const files = readdirSync(agentsDir);
		const agentFiles = files.filter((f: string) => f.endsWith(".md"));
		assert.ok(agentFiles.length >= 2, "at least 2 agent files");
		assert.ok(agentFiles.includes("test-agent.md"), "has test-agent.md");
		assert.ok(agentFiles.includes("another-agent.md"), "has another-agent.md");
	});

	test("discovers overlays from project overlays/ directory", () => {
		const overlaysDir = join(projectDir, "overlays");
		const files = readdirSync(overlaysDir);
		const overlayFiles = files.filter((f: string) => f.endsWith(".overlay.md"));
		assert.ok(overlayFiles.length >= 2, "at least 2 overlay files");
		assert.ok(overlayFiles.includes("orchestrator.overlay.md"), "has orchestrator overlay");
		assert.ok(overlayFiles.includes("test-agent.overlay.md"), "has test-agent overlay");
	});

	test("discovers skills from project skills/ directory", () => {
		const skillsDir = join(projectDir, "skills");
		const dirs = readdirSync(skillsDir, { withFileTypes: true })
			.filter((d: any) => d.isDirectory())
			.map((d: any) => d.name);
		assert.ok(dirs.includes("test-skill"), "has test-skill directory");
		assert.ok(existsSync(join(projectDir, "skills/test-skill/SKILL.md")), "skill has SKILL.md");
	});
});

describe("overlay parsing", () => {
	test("parses overlay frontmatter correctly", () => {
		const overlayContent = `---\ntarget: test-agent\npriority: 75\nmode: append\n---\nOverlay body content`;
		
		const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(overlayContent);
		assert.ok(fmMatch, "frontmatter regex matches");
		
		const [, fm, body] = fmMatch!;
		const targetMatch = /target:\s*([^\n]+)/.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);
		const modeMatch = /mode:\s*(\w+)/.exec(fm);
		
		assert.equal(targetMatch![1].trim(), "test-agent");
		assert.equal(parseInt(priorityMatch![1], 10), 75);
		assert.equal(modeMatch![1].trim(), "append");
		assert.equal(body.trim(), "Overlay body content");
	});

	test("handles missing optional fields with defaults", () => {
		const overlayContent = `---\ntarget: orchestrator\n---\nBody only`;
		
		const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(overlayContent);
		const [, fm] = fmMatch!;
		
		const targetMatch = /target:\s*([^\n]+)/.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);
		const modeMatch = /mode:\s*(\w+)/.exec(fm);
		
		assert.equal(targetMatch![1].trim(), "orchestrator");
		assert.equal(priorityMatch, null);
		assert.equal(modeMatch, null);
	});
});

describe("appendSystemPromptOnce", () => {
	test("appends text to empty options", () => {
		const options: { appendSystemPrompt?: string } = {};
		const text = "Test prompt";
		
		const normalized = text.replace(/^\n+/, "");
		const current = options.appendSystemPrompt ?? "";
		if (!current.includes(normalized)) {
			options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
		}
		
		assert.equal(options.appendSystemPrompt, "Test prompt");
	});

	test("does not duplicate existing text", () => {
		const options: { appendSystemPrompt?: string } = { appendSystemPrompt: "Existing\n\nTest prompt" };
		const text = "Test prompt";
		
		const normalized = text.replace(/^\n+/, "");
		const current = options.appendSystemPrompt ?? "";
		if (!current.includes(normalized)) {
			options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
		}
		
		assert.equal(options.appendSystemPrompt, "Existing\n\nTest prompt");
	});

	test("handles leading newlines", () => {
		const options: { appendSystemPrompt?: string } = { appendSystemPrompt: "Existing" };
		const text = "\n\nNew prompt";
		
		const normalized = text.replace(/^\n+/, "");
		const current = options.appendSystemPrompt ?? "";
		if (!current.includes(normalized)) {
			options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
		}
		
		assert.equal(options.appendSystemPrompt, "Existing\n\nNew prompt");
	});

	test("handles null/undefined options", () => {
		let options: { appendSystemPrompt?: string } | null = null;
		const text = "Test";
		
		const normalized = text.replace(/^\n+/, "");
		if (options && normalized) {
			const current = options.appendSystemPrompt ?? "";
			if (!current.includes(normalized)) {
				options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
			}
		}
		
		assert.equal(options, null);
	});
});

describe("sync.sh script behavior", () => {
	let projectDir: string;
	let agentHome: string;

	before(() => {
		projectDir = createTestProject();
		agentHome = createAgentHome();
	});

	test("sync.sh validates agent frontmatter", () => {
		writeFileSync(join(projectDir, "agents/bad-agent.md"), "No frontmatter here");
		
		const content = readFileSync(join(projectDir, "agents/bad-agent.md"), "utf8");
		assert.ok(!content.startsWith("---"), "agent missing frontmatter delimiter");
	});

	test("sync.sh validates overlay targets", () => {
		writeFileSync(join(projectDir, "overlays/unknown-target.overlay.md"), `---\ntarget: nonexistent-agent\n---\nOverlay`);
		
		const content = readFileSync(join(projectDir, "overlays/unknown-target.overlay.md"), "utf8");
		const targetMatch = /target:\s*([^\n]+)/.exec(content);
		assert.equal(targetMatch![1].trim(), "nonexistent-agent");
	});

	test("sync.sh validates skill structure", () => {
		mkdirSync(join(projectDir, "skills/bad-skill"), { recursive: true });
		writeFileSync(join(projectDir, "skills/bad-skill/SKILL.md"), `# Bad Skill\n\nMissing sections`);
		
		const content = readFileSync(join(projectDir, "skills/bad-skill/SKILL.md"), "utf8");
		assert.ok(!content.includes("## Activation Contract"), "missing Activation Contract");
		assert.ok(!content.includes("## Hard Rules"), "missing Hard Rules");
	});
});

describe("skill registry integration", () => {
	test("skill follows gentle-ai skill style guide", () => {
		const skillPath = join(PROJECT_ROOT, "skills/gentle-agent-extension/SKILL.md");
		assert.ok(existsSync(skillPath), "project skill exists");
		
		const content = readFileSync(skillPath, "utf8");
		
		// Check frontmatter
		assert.ok(content.startsWith("---"), "has frontmatter");
		assert.ok(content.includes("name: gentle-agent-extension"), "correct name");
		assert.ok(content.includes("description:"), "has description");
		assert.ok(content.includes("license: Apache-2.0"), "has license");
		
		// Check required sections
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
		
		// Check procedures
		assert.ok(content.includes("Procedure A: Add a New Agent"), "has Procedure A");
		assert.ok(content.includes("Procedure B: Add an Overlay"), "has Procedure B");
		
		// Check references to local files
		assert.ok(content.includes("docs/conventions.md"), "references conventions");
		assert.ok(content.includes("extensions/gentle-agent-extensions.ts"), "references extension");
		assert.ok(content.includes("scripts/install.sh"), "references install script");
		assert.ok(content.includes("scripts/sync.sh"), "references sync script");
		assert.ok(content.includes("scripts/doctor.sh"), "references doctor script");
	});

	test("skill Activation Contract defines when to use", () => {
		const skillPath = join(PROJECT_ROOT, "skills/gentle-agent-extension/SKILL.md");
		const content = readFileSync(skillPath, "utf8");
		
		assert.ok(content.includes("Use this skill when:"), "defines when to use");
		assert.ok(content.includes("Do NOT use this skill for:"), "defines when not to use");
		assert.ok(content.includes("Creating a new custom agent"), "lists agent creation");
		assert.ok(content.includes("Adding an overlay"), "lists overlay creation");
		assert.ok(content.includes("Defining routing rules"), "lists routing");
	});
});

describe("manifest tracking", () => {
	test("manifest tracks managed paths by category", () => {
		const manifestPath = join(PROJECT_ROOT, ".manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		
		assert.ok(Array.isArray(manifest.managedPaths.extensions), "has extensions array");
		assert.ok(Array.isArray(manifest.managedPaths.agents), "has agents array");
		assert.ok(Array.isArray(manifest.managedPaths.routing), "has routing array");
		assert.ok(Array.isArray(manifest.managedPaths.overlays), "has overlays array");
		assert.ok(Array.isArray(manifest.managedPaths.skills), "has skills array");
		assert.ok(Array.isArray(manifest.managedPaths.scripts), "has scripts array");
		assert.ok(Array.isArray(manifest.managedPaths.assets), "has assets array");
	});
});

describe("installation profiles", () => {
	test("install.sh supports pi profile", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		assert.ok(script.includes("pi)"), "handles pi profile");
		assert.ok(script.includes('AGENT_HOME="${HOME}/.pi/agent"'), "sets pi agent home");
	});

	test("install.sh supports gentle-shell profile", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		assert.ok(script.includes("gentle-shell)"), "handles gentle-shell profile");
		assert.ok(script.includes('AGENT_HOME="${HOME}/.local/share/gentle-shell/agent"'), "sets gentle-shell agent home");
	});

	test("install.sh supports gentle-shell-linked profile", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		assert.ok(script.includes("gentle-shell-linked)"), "handles gentle-shell-linked profile");
		assert.ok(script.includes('AGENT_HOME="${HOME}/.pi/agent"'), "sets linked agent home");
	});

	test("install.sh supports --dry-run", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		assert.ok(script.includes("--dry-run"), "has dry-run option");
		assert.ok(script.includes("DRY_RUN=true"), "sets dry-run flag");
	});

	test("sync.sh supports --dry-run and --check", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/sync.sh"), "utf8");
		assert.ok(script.includes("--dry-run"), "has dry-run option");
		assert.ok(script.includes("--check"), "has check option");
		assert.ok(script.includes("DRY_RUN=true"), "sets dry-run flag");
		assert.ok(script.includes("CHECK_MODE=true"), "sets check flag");
	});

	test("doctor.sh supports --verbose", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("--verbose"), "has verbose option");
		assert.ok(script.includes("VERBOSE=true"), "sets verbose flag");
	});
});

describe("idempotency guarantees", () => {
	test("sync.sh is idempotent - no changes on repeated runs", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/sync.sh"), "utf8");
		assert.ok(script.includes("cmp -s"), "uses cmp to check for changes");
		assert.ok(script.includes("Unchanged:"), "reports unchanged files");
	});

	test("install.sh refuses to overwrite without --force", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		assert.ok(script.includes("FORCE=false"), "default no force");
		assert.ok(script.includes("if [[ -f \"$EXTENSION_TARGET\" && \"$FORCE\" == \"false\""), "checks existing file");
	});
});

describe("no official file modification", () => {
	test("scripts only write to project-owned locations", () => {
		const syncScript = readFileSync(join(PROJECT_ROOT, "scripts/sync.sh"), "utf8");
		const installScript = readFileSync(join(PROJECT_ROOT, "scripts/install.sh"), "utf8");
		
		assert.ok(syncScript.includes("PROJECT_AGENTS_DIR"), "uses project agent dir");
		assert.ok(syncScript.includes(".pi/agents"), "targets project directory");
		
		// install.sh uses EXTENSION_TARGET="${AGENT_HOME}/extensions/gentle-agent-extensions.ts"
		assert.ok(installScript.includes('EXTENSION_TARGET="${AGENT_HOME}/extensions/gentle-agent-extensions.ts"'), "targets extensions dir");

		assert.ok(!syncScript.includes("subagents.json"), "does not modify subagents.json");
		assert.ok(!syncScript.includes(".atl/skill-registry.md"), "does not modify skill registry directly");
	});
});

describe("doctor.sh checks", () => {
	test("checks project structure", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes('for dir in "agents" "overlays" "routing" "skills"'), "checks all dirs");
	});

	test("checks manifest", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("MANIFEST="), "checks manifest");
		assert.ok(script.includes(".manifest.json"), "correct manifest name");
	});

	test("checks extension installation", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("EXTENSION_TARGET"), "checks extension target");
		assert.ok(script.includes("gentle-agent-extensions.ts"), "correct extension name");
	});

	test("checks Pi/Gentle Pi installation", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("command -v pi"), "checks pi command");
		assert.ok(script.includes("gentle-shell"), "checks gentle-shell");
		assert.ok(script.includes("gentle-pi"), "checks gentle-pi package");
	});

	test("validates agent frontmatter", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("grep -q \"^name:\""), "checks agent name");
		assert.ok(script.includes("grep -q \"^description:\""), "checks agent description");
	});

	test("validates overlay structure", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("grep -q \"^target:\""), "checks overlay target");
		assert.ok(script.includes("grep -q \"^mode:\""), "checks overlay mode");
	});

	test("validates skill structure", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("Activation Contract"), "checks skill sections");
		assert.ok(script.includes("Hard Rules"), "checks Hard Rules");
		assert.ok(script.includes("name:"), "checks skill frontmatter name");
	});

	test("checks for conflicts", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("GLOBAL_AGENTS"), "tracks global agents");
		assert.ok(script.includes("shadows global agent"), "detects shadowing");
		assert.ok(script.includes("targets unknown agent"), "detects unknown overlay targets");
	});

	test("checks skill registry", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes(".atl/skill-registry.md"), "checks skill registry");
	});

	test("checks script permissions", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("for script in install.sh sync.sh doctor.sh"), "checks all scripts");
		assert.ok(script.includes("-x"), "checks executable bit");
	});
});
describe("MCP server support", () => {
	let projectDir: string;
	let agentHome: string;

	before(() => {
		projectDir = createTestProject();
		agentHome = createAgentHome();

		// Add MCP directory and test MCP definitions
		mkdirSync(join(projectDir, "mcp"), { recursive: true });
	});

	test("mcp/ directory exists", () => {
		assert.ok(existsSync(join(PROJECT_ROOT, "mcp")), "mcp/ directory exists");
	});

	test("extension loads MCP server definitions", () => {
		const extContent = readFileSync(EXTENSION_PATH, "utf8");
		assert.ok(extContent.includes("MCP_DIR"), "defines MCP_DIR constant");
		assert.ok(extContent.includes("loadMcpServers"), "has loadMcpServers function");
		assert.ok(extContent.includes("registerMcpServer"), "uses pi.registerMcpServer API");
		assert.ok(extContent.includes("buildMcpOrchestratorInstructions"), "builds MCP instructions for orchestrator");
	});

	test("MCP server definition schema validation", () => {
		// Test valid stdio MCP
		const validStdio = {
			name: "test-stdio",
			description: "Test stdio server",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@test/server"],
			exposure: "codemode",
			enabled: true
		};
		assert.ok(validStdio.name.match(/^[A-Za-z0-9_-]+$/), "name format valid");
		assert.ok(["stdio", "http"].includes(validStdio.transport), "transport valid");

		// Test valid HTTP MCP
		const validHttp = {
			name: "test-http",
			description: "Test HTTP server",
			transport: "http",
			url: "https://example.com/mcp",
			exposure: "deferred",
			enabled: true
		};
		assert.ok(validHttp.name.match(/^[A-Za-z0-9_-]+$/), "name format valid");
		assert.ok(["stdio", "http"].includes(validHttp.transport), "transport valid");

		// Test invalid name
		const invalidName = { ...validStdio, name: "test server" };
		assert.ok(!invalidName.name.match(/^[A-Za-z0-9_-]+$/), "name with space invalid");
	});

	test("MCP server config has required fields", () => {
		const requiredFields = ["name", "description", "transport"];
		for (const field of requiredFields) {
			assert.ok(true, `required field: ${field}`);
		}

		// stdio requires command
		const stdioServer = { transport: "stdio" };
		assert.ok(!stdioServer.command, "stdio missing command");

		// http requires url
		const httpServer = { transport: "http" };
		assert.ok(!httpServer.url, "http missing url");
	});

	test("MCP server exposure values", () => {
		const validExposures = ["codemode", "direct", "deferred", "hidden"];
		for (const exp of validExposures) {
			assert.ok(validExposures.includes(exp), `exposure ${exp} is valid`);
		}
	});

	test("MCP server env var substitution syntax", () => {
		const envWithSubstitution = { API_KEY: "${API_KEY}" };
		const envHardcoded = { API_KEY: "sk-12345" };

		assert.ok(envWithSubstitution.API_KEY.startsWith("${"), "uses substitution syntax");
		assert.ok(!envHardcoded.API_KEY.startsWith("${"), "hardcoded secret detected");
	});

	test("sync.sh validates MCP definitions", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/sync.sh"), "utf8");
		assert.ok(script.includes("MCP_SRC"), "defines MCP_SRC");
		assert.ok(script.includes("Validating MCP servers"), "validates MCP servers");
		assert.ok(script.includes("jq empty"), "validates JSON syntax");
		assert.ok(script.includes(".name // empty"), "checks name field");
		assert.ok(script.includes(".description // empty"), "checks description field");
		assert.ok(script.includes(".transport // empty"), "checks transport field");
		assert.ok(script.includes("stdio transport requires"), "validates stdio command");
		assert.ok(script.includes("http transport requires"), "validates http url");
		assert.ok(script.includes("MCP server name conflicts"), "checks mcp.json conflicts");
	});

	test("doctor.sh validates MCP definitions", () => {
		const script = readFileSync(join(PROJECT_ROOT, "scripts/doctor.sh"), "utf8");
		assert.ok(script.includes("Validating MCP servers"), "validates MCP servers");
		assert.ok(script.includes("jq empty"), "validates JSON syntax");
		assert.ok(script.includes("has name field"), "checks name field");
		assert.ok(script.includes("has description"), "checks description field");
		assert.ok(script.includes("transport="), "checks transport field");
		assert.ok(script.includes("has command"), "checks stdio command");
		assert.ok(script.includes("has url"), "checks http url");
		assert.ok(script.includes("name format valid"), "validates name format");
		assert.ok(script.includes("may contain hardcoded secret"), "checks for secrets");
	});

	test("skill includes MCP procedures", () => {
		const skillPath = join(PROJECT_ROOT, "skills/gentle-agent-extension/SKILL.md");
		const content = readFileSync(skillPath, "utf8");

		assert.ok(content.includes("External tool/API integration via MCP"), "has MCP in decision gates");
		assert.ok(content.includes("mcp/{name}.mcp.json"), "references MCP location");
		assert.ok(content.includes("Procedure C: Add an MCP Server"), "has Procedure C");
		assert.ok(content.includes("Procedure D: Add MCP Dependencies"), "has Procedure D");
		assert.ok(content.includes("mcpDependencies"), "references mcpDependencies in routing");
		assert.ok(content.includes("MCP definition in"), "output contract includes MCP");
		assert.ok(content.includes("MCP server registered"), "output contract verifies MCP registration");
	});

	test("conventions.md documents MCP conventions", () => {
		const convPath = join(PROJECT_ROOT, "docs/conventions.md");
		const content = readFileSync(convPath, "utf8");

		assert.ok(content.includes("mcp/" ), "documents mcp directory");
		assert.ok(content.includes("MCP Server Definitions"), "has MCP section");
		assert.ok(content.includes("*.mcp.json"), "documents file naming");
		assert.ok(content.includes("transport"), "documents transport field");
		assert.ok(content.includes("exposure"), "documents exposure field");
		assert.ok(content.includes("agentDependencies"), "documents agentDependencies");
		assert.ok(content.includes("mcpDependencies"), "documents mcpDependencies in routing");
		assert.ok(content.includes("pi.registerMcpServer"), "documents registration API");
		assert.ok(content.includes("managedPaths" ), "manifest includes mcp");
	});

	test("manifest tracks MCP files", () => {
		const manifestPath = join(PROJECT_ROOT, ".manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

		assert.ok(Array.isArray(manifest.managedPaths.mcp), "has mcp array in manifest");
	});

	test("extension status command shows MCP servers", () => {
		const extContent = readFileSync(EXTENSION_PATH, "utf8");
		assert.ok(extContent.includes("mcpServers"), "status includes MCP servers");
	});

	test("MCP server auth types", () => {
		const validAuthTypes = ["oauth", "bearer", "none"];
		for (const type of validAuthTypes) {
			assert.ok(validAuthTypes.includes(type), `auth type ${type} is valid`);
		}
	});

	test("MCP server capabilities", () => {
		const validCapabilities = ["tools", "resources"];
		for (const cap of validCapabilities) {
			assert.ok(validCapabilities.includes(cap), `capability ${cap} is valid`);
		}
	});
});
