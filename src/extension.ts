import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createRuntime } from "./core/runtime.js";
import { registerEvents } from "./events/register.js";
import { registerCommands } from "./commands/register.js";

export default function gentleAgentExtensions(pi: ExtensionAPI): void {
	const runtime = createRuntime(pi);

	registerEvents(pi, runtime);
	registerCommands(pi, runtime);
}