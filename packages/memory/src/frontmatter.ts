export interface NoteFrontmatter {
  id: string;
  type: string;
  tags: string[];
  runId?: string;
  updated: string;
  title: string;
}

export function serializeNote(
  fm: NoteFrontmatter,
  body: string,
  links: string[] = [],
): string {
  const linkLine =
    links.length > 0
      ? `\n\n## Links\n${links.map((l) => `- [[${l}]]`).join("\n")}`
      : "";
  const tags = fm.tags.length ? fm.tags.join(", ") : "";
  return (
    `---\n` +
    `id: ${fm.id}\n` +
    `type: ${fm.type}\n` +
    `title: ${JSON.stringify(fm.title)}\n` +
    `tags: [${tags}]\n` +
    (fm.runId ? `runId: ${fm.runId}\n` : "") +
    `updated: ${fm.updated}\n` +
    `---\n\n` +
    `# ${fm.title}\n\n` +
    `${body.trim()}${linkLine}\n`
  );
}

export function parseFrontmatter(raw: string): {
  frontmatter: Partial<NoteFrontmatter>;
  body: string;
} {
  if (!raw.startsWith("---\n")) {
    return { frontmatter: {}, body: raw };
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return { frontmatter: {}, body: raw };
  const block = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const fm: Partial<NoteFrontmatter> = { tags: [] };
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    switch (key) {
      case "id":
        fm.id = value;
        break;
      case "type":
        fm.type = value;
        break;
      case "title":
        fm.title = value;
        break;
      case "runId":
        fm.runId = value;
        break;
      case "updated":
        fm.updated = value;
        break;
      case "tags": {
        const inner = value.replace(/^\[/, "").replace(/\]$/, "");
        fm.tags = inner
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      }
      default:
        break;
    }
  }
  return { frontmatter: fm, body };
}
