export type OverlayMode = "append" | "prepend" | "replace";

export interface OverlayDefinition {
	target: string;
	priority: number;
	mode: OverlayMode;
	instructions: string;
}

export interface OverlayApplicationOptions {
	appendSystemPrompt?: string;
	systemPrompt?: string;
}

export interface OverlayApplicationResult {
	applied: OverlayDefinition[];
	skipped: OverlayDefinition[];
}