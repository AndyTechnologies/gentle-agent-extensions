import { BUNDLED, ensureDir, readFileSync, writeFileSync, existsSync, join, hashContent } from "../core/paths.js";
import { logger } from "../core/logger.js";
import type { AgentSyncResult } from "./types.js";

export async function syncBundledAgentsToProject(
	projectAgentDir: string,
	bundledAgentNames: Set<string>
): Promise<AgentSyncResult> {
	ensureDir(projectAgentDir);

	const synced: string[] = [];
	const conflicts: string[] = [];
	const skipped: string[] = [];

	if (!existsSync(BUNDLED.agents)) return { synced, conflicts, skipped };

	for (const agentName of bundledAgentNames) {
		const sourcePath = join(BUNDLED.agents, `${agentName}.md`);
		const targetPath = join(projectAgentDir, `${agentName}.md`);

		try {
			const sourceContent = readFileSync(sourcePath, "utf8");
			const sourceHash = hashContent(sourceContent);

			if (existsSync(targetPath)) {
				const targetContent = readFileSync(targetPath, "utf8");
				const targetHash = hashContent(targetContent);

				if (targetHash === sourceHash) {
					skipped.push(agentName);
					continue;
				}

				conflicts.push(agentName);
				continue;
			}

			writeFileSync(targetPath, sourceContent);
			synced.push(agentName);
		} catch (error) {
			logger.warn(`Failed to sync agent ${agentName}: ${error}`);
		}
	}

	return { synced, conflicts, skipped };
}