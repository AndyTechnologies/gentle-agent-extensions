export interface AgentDefinition {
	name: string;
	description: string;
	tools?: string[];
}

export interface AgentSyncResult {
	synced: string[];
	conflicts: string[];
	skipped: string[];
}

export interface AgentResource {
	name: string;
	content: string;
	hash: string;
	path: string;
}