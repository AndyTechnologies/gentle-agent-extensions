export function parseYamlArray(text: string): string[] {
	const items: string[] = [];
	const lines = text.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const match = /^[-*]\s*(.+)$/.exec(trimmed);
		if (match && match[1]) {
			items.push(match[1].trim().replace(/^["']|["']$/g, ""));
		}
	}
	return items;
}