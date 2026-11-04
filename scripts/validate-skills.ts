#!/usr/bin/env npx tsx
/**
 * Skill Quality Validator
 * Validates all skills in resources/skills/ directory
 * 
 * Usage: npx tsx scripts/validate-skills.ts
 * Exit codes: 0 = PASS, 1 = FAIL
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "resources", "skills");

interface SkillFrontmatter {
	name: string;
	description: string;
	license: string;
	metadata: {
		author: string;
		version: string;
	};
	"disable-model-invocation"?: boolean;
}

interface ValidationResult {
	skillName: string;
	errors: string[];
	warnings: string[];
}

interface SkillNode {
	name: string;
	path: string;
	frontmatter: SkillFrontmatter;
	content: string;
	references: string[];
	dependencies: string[];
}

function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter | null; body: string } {
	const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
	if (!fmMatch) return { frontmatter: null, body: content };
	
	const [, fm, body] = fmMatch;
	try {
		const frontmatter = parseYaml(fm) as SkillFrontmatter;
		return { frontmatter, body };
	} catch {
		return { frontmatter: null, body };
	}
}

function parseYaml(yaml: string): object {
	// Simple YAML parser for our needs
	const result: Record<string, any> = {};
	let currentKey: string | null = null;
	let inMetadata = false;
	let metadataObj: Record<string, any> = {};
	
	for (const line of yaml.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		
		if (trimmed === "metadata:") {
			inMetadata = true;
			continue;
		}
		
		if (inMetadata) {
			const metaMatch = /^(\w+):\s*(.+)$/.exec(trimmed);
			if (metaMatch) {
				metadataObj[metaMatch[1]] = metaMatch[2].replace(/^["']|["']$/g, "");
			}
			continue;
		}
		
		const match = /^(\w+):\s*(.+)$/.exec(trimmed);
		if (match) {
			const value = match[2].replace(/^["']|["']$/g, "");
			if (match[1] === "metadata") {
				inMetadata = true;
			} else {
				result[match[1]] = value;
			}
		}
	}
	
	if (Object.keys(metadataObj).length > 0) {
		result.metadata = metadataObj;
	}
	
	return result;
}

function parseYamlArray(text: string): string[] {
	const items: string[] = [];
	const lines = text.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const match = /^[-*]\s*(.+)$/.exec(trimmed);
		if (match) {
			items.push(match[1].trim().replace(/^["']|["']$/g, ""));
		}
	}
	return items;
}

function extractReferences(content: string): string[] {
	const foundRefs: string[] = [];
	// Find backtick-quoted references
	const backtickRefs = content.match(/`([^`]+)`/g) || [];
	for (const ref of backtickRefs) {
		const skillRef = ref.slice(1, -1);
		if (skillRef.includes("skill") || skillRef.includes("Skill")) {
			foundRefs.push(skillRef);
		}
	}
	// Find References section
	const refsMatch = /## References\n([\s\S]*?)(?:\n##|$)/.exec(content);
	if (refsMatch) {
		const refsContent = refsMatch[1];
		const skillRefs = refsContent.match(/`([^`]+)`/g) || [];
		for (const ref of skillRefs) {
			const skillRef = ref.slice(1, -1);
			if (skillRef.includes("skill") || skillRef.includes("Skill")) {
				foundRefs.push(skillRef);
			}
		}
	}
	return [...new Set(foundRefs)];
}

function extractExternalUrls(content: string): string[] {
	const urls: string[] = [];
	const urlRegex = /https?:\/\/[^\s\)\]\}]+/g;
	let match;
	while ((match = urlRegex.exec(content)) !== null) {
		urls.push(match[0]);
	}
	return [...new Set(urls)];
}

async function validateSkill(skillDir: string, skillsDir: string, allSkills: Set<string>): Promise<ValidationResult> {
	const skillName = basename(skillDir);
	const skillPath = join(skillsDir, skillDir, "SKILL.md");
	
	const result: ValidationResult = {
		skillName,
		errors: [],
		warnings: [],
	};
	
	if (!existsSync(skillPath)) {
		result.errors.push("SKILL.md not found");
		return result;
	}
	
	const content = readFileSync(skillPath, "utf8");
	const { frontmatter, body } = parseFrontmatter(content);
	
	// 1. Validate Frontmatter
	if (!frontmatter) {
		result.errors.push("Invalid or missing frontmatter");
		return result;
	}
	
	const requiredFields = ["name", "description", "license", "metadata"];
	for (const field of requiredFields) {
		if (!frontmatter[field as keyof SkillFrontmatter]) {
			result.errors.push(`Missing required frontmatter field: ${field}`);
		}
	}
	
	if (frontmatter.metadata) {
		const requiredMeta = ["author", "version"];
		for (const field of requiredMeta) {
			if (!frontmatter.metadata[field]) {
				result.errors.push(`Missing required metadata field: ${field}`);
			}
		}
	}
	
	// Name consistency
	if (frontmatter.name !== skillDir) {
		result.errors.push(`Frontmatter name "${frontmatter.name}" doesn't match directory name "${skillDir}"`);
	}
	
	// Description must contain "Trigger:"
	if (frontmatter.description && !frontmatter.description.includes("Trigger:")) {
		result.warnings.push('Description should contain "Trigger:" phrase');
	}
	
	// 2. Validate Structure - required sections
	const requiredSections = [
		"## Activation Contract",
		"## Hard Rules",
		"## Decision Gates",
		"## Execution Steps",
		"## Output Contract",
		"## References"
	];
	
	for (const section of requiredSections) {
		if (!body.includes(section)) {
			result.errors.push(`Missing required section: ${section}`);
		}
	}
	
	// 3. Validate References
	const references = extractReferences(body);
	for (const ref of references) {
		if (!allSkills.has(ref)) {
			result.warnings.push(`Referenced skill "${ref}" not found in skills directory`);
		}
	}
	
	// 4. Check for circular dependencies (will be done globally)
	
	// 5. Check invocation compatibility
	const disableModelInvocation = frontmatter["disable-model-invocation"];
	if (disableModelInvocation === true) {
		// Check if any other skill references this as a dependency for auto-invocation
		// This is a warning since we can't fully verify without global analysis
	}
	
	// 6. External links
	const urls = extractExternalUrls(content);
	for (const url of urls) {
		result.warnings.push(`External link found: ${url} (not verified)`);
	}
	
	return result;
}

async function main(): Promise<void> {
	if (!existsSync(SKILLS_DIR)) {
		console.error("Skills directory not found:", SKILLS_DIR);
		process.exit(1);
	}
	
	const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
		.filter(d => d.isDirectory())
		.map(d => d.name);
	
	const allSkills = new Set(skillDirs);
	
	console.log(`Validating ${skillDirs.length} skills...\n`);
	
	const results: ValidationResult[] = [];
	
	for (const skillDir of skillDirs) {
		const result = await validateSkill(skillDir, SKILLS_DIR, allSkills);
		results.push(result);
	}
	
	// Check for circular dependencies
	const skillGraph = new Map<string, string[]>();
	for (const skillDir of skillDirs) {
		const skillPath = join(SKILLS_DIR, skillDir, "SKILL.md");
		if (existsSync(skillPath)) {
			const content = readFileSync(skillPath, "utf8");
			const { body } = parseFrontmatter(readFileSync(skillPath, "utf8"));
			const refs = extractReferences(body);
			skillGraph.set(skillDir, refs.filter(r => allSkills.has(r)));
		}
	}
	
	// Detect cycles
	const visited = new Set<string>();
	const recStack = new Set<string>();
	const cycles: string[] = [];
	
	function detectCycle(node: string): boolean {
		visited.add(node);
		recStack.add(node);
		const neighbors = skillGraph.get(node) || [];
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				if (detectCycle(neighbor)) return true;
			} else if (recStack.has(neighbor)) {
				cycles.push(`${node} -> ${neighbor}`);
				return true;
			}
		}
		recStack.delete(node);
		return false;
	}
	
	for (const node of skillGraph.keys()) {
		if (!visited.has(node)) {
			detectCycle(node);
		}
	}
	
	// Print results
	let totalErrors = 0;
	let totalWarnings = 0;
	
	for (const result of results) {
		if (result.errors.length > 0) {
			console.log(`\n❌ ${result.skillName}:`);
			for (const error of result.errors) {
				console.log(`  ERROR: ${error}`);
				totalErrors++;
			}
		}
		if (result.warnings.length > 0) {
			console.log(`\n⚠️  ${result.skillName}:`);
			for (const warning of result.warnings) {
				console.log(`  WARNING: ${warning}`);
				totalWarnings++;
			}
		}
		if (result.errors.length === 0 && result.warnings.length === 0) {
			console.log(`✅ ${result.skillName}: OK`);
		}
	}
	
	if (cycles.length > 0) {
		console.log(`\n🔴 CIRCULAR DEPENDENCIES DETECTED:`);
		for (const cycle of cycles) {
			console.log(`  ${cycle}`);
			totalErrors++;
		}
	}
	
	console.log(`\n========================`);
	console.log(`Skills checked: ${results.length}`);
	console.log(`Errors: ${totalErrors}`);
	console.log(`Warnings: ${totalWarnings}`);
	console.log(`Status: ${totalErrors === 0 ? "PASS" : "FAIL"}`);
	
	if (totalErrors > 0) {
		process.exit(1);
	}
}

main().catch(e => {
	console.error("Validation failed:", e);
	process.exit(1);
});