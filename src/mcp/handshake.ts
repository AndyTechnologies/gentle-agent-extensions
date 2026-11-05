import { spawn } from "node:child_process";
import { MCP_HANDSHAKE_TIMEOUT, MCP_HTTP_TIMEOUT, MCP_INIT_RETRY_DELAY } from "../core/constants.js";
import type { McpServerDefinition, McpHandshakeResult } from "./types.js";

interface McpErrorResponse {
	error: {
		message?: string;
		[key: string]: unknown;
	};
}

interface McpInitializeResponse {
	id?: number;
	result?: {
		tools?: unknown[];
	};
	error?: {
		message?: string;
		[key: string]: unknown;
	};
}

export async function performMcpHandshake(
	child: ReturnType<typeof spawn>,
	_serverName: string,
	_server: McpServerDefinition
): Promise<McpHandshakeResult> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			child.kill();
			resolve({ ok: false, error: "handshake timeout (10s)" });
		}, MCP_HANDSHAKE_TIMEOUT);

		let buffer = "";
		let initializedSent = false;
		let initAttempted = false;

		const sendInit = () => {
			const initMsg = JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "gentle-agent-extensions-doctor", version: "1.0.0" },
				},
			});
			child.stdin?.write(initMsg + "\n");
			initAttempted = true;
		};

		child.stdout?.on("data", (data: Buffer) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const msg = JSON.parse(line) as McpInitializeResponse;

					if (msg.id === 1 && msg.result) {
						const initializedMsg = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" });
						child.stdin?.write(initializedMsg + "\n");
						initializedSent = true;

						const toolsMsg = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
						child.stdin?.write(toolsMsg + "\n");
					}

					if (msg.id === 2 && msg.result && msg.result.tools) {
						clearTimeout(timeout);
						child.kill();
						resolve({ ok: true });
					}

					if (msg.error) {
						clearTimeout(timeout);
						child.kill();
						resolve({ ok: false, error: `MCP error: ${msg.error.message || JSON.stringify(msg.error)}` });
					}
				} catch {
					// Ignore parse errors
				}
			}
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			resolve({ ok: false, error: `process error: ${err.message}` });
		});

		child.on("exit", (code) => {
			clearTimeout(timeout);
			if (code !== 0 && code !== null) {
				resolve({ ok: false, error: `exited with code ${code}` });
			}
		});

		// Send initialize immediately
		sendInit();

		// Retry init if no response after 2s
		setTimeout(() => {
			if (!initializedSent && initAttempted) {
				sendInit();
			}
		}, MCP_INIT_RETRY_DELAY);
	});
}

export async function performHttpMcpHandshake(server: McpServerDefinition): Promise<McpHandshakeResult> {
	const start = Date.now();
	try {
		const response = await fetch(server.url!, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "gentle-agent-extensions-doctor", version: "1.0.0" },
				},
			}),
			signal: AbortSignal.timeout(MCP_HTTP_TIMEOUT),
		});

		if (!response.ok) {
			return { ok: false, error: `HTTP ${response.status}`, latencyMs: Date.now() - start };
		}

		const data = await response.json() as McpErrorResponse;
		if (data.error) {
			return { ok: false, error: `MCP error: ${data.error.message || JSON.stringify(data.error)}`, latencyMs: Date.now() - start };
		}

		await fetch(server.url!, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
			signal: AbortSignal.timeout(2000),
		}).catch(() => {});

		return { ok: true, latencyMs: Date.now() - start };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start };
	}
}