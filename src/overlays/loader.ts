import { BUNDLED, readFileSync, existsSync, readdirSync, join } from "../core/paths.js";
import { logger } from "../core/logger.js";
import { OVERLAY_MODES, type OverlayMode } from "../core/constants.js";
import type { OverlayDefinition } from "./types.js";

export function loadBundledOverlays(): Map<string, OverlayDefinition[]> {
	const overlays = new Map<string, OverlayDefinition[]>();

	if (!existsSync(BUNDLED.overlays)) return overlays;

	for (const file of readdirSync(BUNDLED.overlays)) {
		if (!file.endsWith(".overlay.md")) continue;

		const filePath = join(BUNDLED.overlays, file);
		const content = readFileSync(filePath, "utf8");

		const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
		if (!frontmatterMatch) continue;

		const [, fm, body] = frontmatterMatch;
		const targetMatch = /target:\s*([^\n]+)/.exec(fm);
		const priorityMatch = /priority:\s*(\d+)/.exec(fm);
		const modeMatch = /mode:\s*(\w+)/.exec(fm);

		if (!targetMatch?.[1]) continue;

		const target = targetMatch[1].trim();
		const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 100;
		const mode = (modeMatch?.[1]?.trim() ?? "append") as OverlayMode;

		if (!OVERLAY_MODES.includes(mode)) {
			logger.warn(`Unknown overlay mode '${mode}' for ${file}, defaulting to 'append'`);
		}

		const overlay: OverlayDefinition = {
			target,
			priority,
			mode,
			instructions: body.trim(),
		};

		const existing = overlays.get(target) || [];
		existing.push(overlay);
		existing.sort((a, b) => a.priority - b.priority);
		overlays.set(target, existing);
	}

	return overlays;
}