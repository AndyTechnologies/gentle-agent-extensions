import type { OverlayDefinition, OverlayApplicationOptions } from "./types.js";

export function appendSystemPromptOnce(options: OverlayApplicationOptions | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	const current = options.appendSystemPrompt ?? "";
	if (current.includes(normalized)) return;
	options.appendSystemPrompt = current ? `${current}\n\n${normalized}` : normalized;
}

export function prependSystemPromptOnce(options: OverlayApplicationOptions | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	const current = options.appendSystemPrompt ?? "";
	if (current.includes(normalized)) return;
	options.appendSystemPrompt = normalized + (current ? `\n\n${current}` : "");
}

export function replaceSystemPrompt(options: OverlayApplicationOptions | null | undefined, text: string): void {
	const normalized = text.replace(/^\n+/, "");
	if (!options || !normalized) return;
	options.systemPrompt = normalized;
	options.appendSystemPrompt = "";
}

export function applyOverlay(
	overlay: OverlayDefinition,
	targetName: string,
	options: OverlayApplicationOptions | null | undefined
): void {
	const text = `\n\n<!-- gentle-agent-extensions: bundled overlay for ${targetName} -->\n${overlay.instructions}`;
	switch (overlay.mode) {
		case "prepend":
			prependSystemPromptOnce(options, text);
			break;
		case "replace":
			replaceSystemPrompt(options, text);
			break;
		case "append":
		default:
			appendSystemPromptOnce(options, text);
			break;
	}
}

export function applyOverlays(
	overlays: OverlayDefinition[],
	targetName: string,
	options: OverlayApplicationOptions | null | undefined
): void {
	for (const overlay of overlays) {
		applyOverlay(overlay, targetName, options);
	}
}