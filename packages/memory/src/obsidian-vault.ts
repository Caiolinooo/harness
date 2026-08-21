import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseFrontmatter, serializeNote } from "./frontmatter.js";
import {
  MemoryEventSchema,
  type MemoryBackend,
  type MemoryEvent,
  type MemoryHit,
  type MemoryKind,
  type MemorySettings,
  type MemorySnapshot,
} from "./types.js";

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "note";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function walkMarkdown(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name.startsWith(".")) continue;
      out.push(...walkMarkdown(full, base));
    } else if (name.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Obsidian-compatible markdown vault memory.
 * When vaultPath is empty → dataDir/vault.
 * When vaultPath is set (external) → writes only under Harness/<projectId>/.
 */
export class ObsidianVaultMemory implements MemoryBackend {
  readonly root: string;

  constructor(
    private readonly dataDir: string,
    private readonly settings: MemorySettings,
  ) {
    if (settings.vaultPath.trim()) {
      this.root = resolve(
        settings.vaultPath,
        "Harness",
        settings.projectId || "default",
      );
    } else {
      this.root = resolve(dataDir, "vault");
    }
    this.ensureLayout();
  }

  private ensureLayout(): void {
    for (const sub of [
      "Semantic",
      "Semantic/entities",
      "Episodes",
      "Episodes/runs",
      "Procedures",
    ]) {
      mkdirSync(join(this.root, sub), { recursive: true });
    }
    const index = join(this.root, "index.md");
    if (!existsSync(index)) {
      writeFileSync(
        index,
        serializeNote(
          {
            id: "index",
            type: "moc",
            title: "Harness Memory MOC",
            tags: ["moc", "harness"],
            updated: new Date().toISOString(),
          },
          [
            "Map of Content for The Last Harness memory vault.",
            "",
            "- [[Semantic/decisions]]",
            "- [[Semantic/learnings]]",
            "- [[Procedures/memory-policy]]",
            "- [[Procedures/coding]]",
            "- [[Procedures/unreal-cpp]]",
          ].join("\n"),
        ),
        "utf8",
      );
    }
    this.seedIfMissing(
      "Semantic/decisions.md",
      "decisions",
      "semantic",
      "Decisions",
      "Architecture and product decisions remembered across runs.\n",
      ["semantic", "decisions"],
    );
    this.seedIfMissing(
      "Semantic/learnings.md",
      "learnings",
      "semantic",
      "Learnings",
      "Bugs fixed and lessons learned. Search before re-debugging.\n",
      ["semantic", "learnings"],
    );
    this.seedIfMissing(
      "Procedures/memory-policy.md",
      "memory-policy",
      "procedural",
      "Memory Policy",
      [
        "- Before re-deciding architecture → search `decisions`.",
        "- After a bug is fixed → write a learning.",
        "- Never dump full working memory — only facts, decisions, episodes.",
        "- Prefer short, self-contained notes with wikilinks.",
      ].join("\n"),
      ["procedural", "policy"],
    );
    this.seedIfMissing(
      "Procedures/coding.md",
      "coding-procedure",
      "procedural",
      "Coding Vertical Procedure",
      "Prefer TypeScript, schema-first contracts, and tests before DONE.\n",
      ["procedural", "coding"],
    );
    this.seedIfMissing(
      "Procedures/unreal-cpp.md",
      "unreal-procedure",
      "procedural",
      "Unreal C++ Vertical Procedure",
      "Offline-only UE5. HITL for engine install and asset purchases.\n",
      ["procedural", "unreal"],
    );
  }

  private seedIfMissing(
    rel: string,
    id: string,
    type: string,
    title: string,
    body: string,
    tags: string[],
  ): void {
    const path = join(this.root, rel);
    if (existsSync(path)) return;
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(
      path,
      serializeNote(
        {
          id,
          type,
          title,
          tags,
          updated: new Date().toISOString(),
        },
        body,
      ),
      "utf8",
    );
  }

  private kindDir(kind: MemoryKind): string {
    switch (kind) {
      case "semantic":
        return join(this.root, "Semantic");
      case "episodic":
        return join(this.root, "Episodes");
      case "procedural":
        return join(this.root, "Procedures");
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }

  async remember(event: MemoryEvent): Promise<void> {
    const parsed = MemoryEventSchema.parse(event);
    const now = new Date().toISOString();
    const id = parsed.entityId || `${parsed.kind}-${slug(parsed.title)}-${randomUUID().slice(0, 8)}`;

    if (parsed.kind === "episodic") {
      const daily = join(this.root, "Episodes", `${today()}.md`);
      const entry =
        `\n## ${now.slice(11, 19)} — ${parsed.title}\n` +
        (parsed.runId ? `run: \`${parsed.runId}\`\n\n` : "\n") +
        `${parsed.content.trim()}\n`;
      if (!existsSync(daily)) {
        writeFileSync(
          daily,
          serializeNote(
            {
              id: `episode-${today()}`,
              type: "episodic",
              title: `Episodes ${today()}`,
              tags: ["episodic", "daily"],
              runId: parsed.runId,
              updated: now,
            },
            entry,
            parsed.links,
          ),
          "utf8",
        );
      } else {
        appendFileSync(daily, entry, "utf8");
      }
      if (parsed.runId) {
        const runNote = join(this.root, "Episodes", "runs", `${parsed.runId}.md`);
        if (!existsSync(runNote)) {
          writeFileSync(
            runNote,
            serializeNote(
              {
                id: `run-${parsed.runId}`,
                type: "episodic",
                title: `Run ${parsed.runId.slice(0, 8)}`,
                tags: ["episodic", "run"],
                runId: parsed.runId,
                updated: now,
              },
              `## ${parsed.title}\n\n${parsed.content.trim()}\n`,
              parsed.links,
            ),
            "utf8",
          );
        } else {
          appendFileSync(
            runNote,
            `\n## ${parsed.title}\n\n${parsed.content.trim()}\n`,
            "utf8",
          );
        }
      }
      return;
    }

    if (parsed.kind === "semantic" && parsed.entityId) {
      const path = join(this.root, "Semantic", "entities", `${slug(parsed.entityId)}.md`);
      writeFileSync(
        path,
        serializeNote(
          {
            id,
            type: "entity",
            title: parsed.title,
            tags: [...parsed.tags, "semantic", "entity"],
            runId: parsed.runId,
            updated: now,
          },
          parsed.content,
          parsed.links,
        ),
        "utf8",
      );
      return;
    }

    // Append-style semantic/procedural ledger notes
    const ledgerName =
      parsed.kind === "semantic"
        ? parsed.tags.includes("learning") || /learn/i.test(parsed.title)
          ? "learnings.md"
          : "decisions.md"
        : `${slug(parsed.title)}.md`;
    const path = join(this.kindDir(parsed.kind), ledgerName);
    const block =
      `\n## ${now.slice(0, 10)} — ${parsed.title}\n` +
      (parsed.runId ? `run: \`${parsed.runId}\`\n\n` : "\n") +
      `${parsed.content.trim()}\n` +
      (parsed.links.length
        ? parsed.links.map((l) => `- [[${l}]]`).join("\n") + "\n"
        : "");
    if (!existsSync(path)) {
      writeFileSync(
        path,
        serializeNote(
          {
            id,
            type: parsed.kind,
            title: parsed.title,
            tags: [...parsed.tags, parsed.kind],
            runId: parsed.runId,
            updated: now,
          },
          block,
          parsed.links,
        ),
        "utf8",
      );
    } else {
      appendFileSync(path, block, "utf8");
    }
  }

  async search(
    query: string,
    opts?: { kind?: MemoryKind; limit?: number },
  ): Promise<MemoryHit[]> {
    const limit = opts?.limit ?? 10;
    const q = query.toLowerCase().trim();
    if (!q) return this.listRecent(limit);

    const roots = opts?.kind
      ? [this.kindDir(opts.kind)]
      : [
          join(this.root, "Semantic"),
          join(this.root, "Episodes"),
          join(this.root, "Procedures"),
        ];

    const hits: MemoryHit[] = [];
    for (const root of roots) {
      for (const file of walkMarkdown(root)) {
        const raw = readFileSync(file, "utf8");
        const { frontmatter, body } = parseFrontmatter(raw);
        const hay = `${frontmatter.title ?? ""} ${body} ${(frontmatter.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) continue;
        const kind = this.kindFromPath(file);
        const idx = hay.indexOf(q);
        const excerptStart = Math.max(0, idx - 80);
        hits.push({
          path: relative(this.root, file).replace(/\\/g, "/"),
          kind,
          title: frontmatter.title || relative(this.root, file),
          excerpt: body.slice(excerptStart, excerptStart + 240).trim(),
          score: (hay.split(q).length - 1) * 10 + (frontmatter.tags?.some((t) => t.includes(q)) ? 5 : 0),
          tags: frontmatter.tags ?? [],
        });
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async listRecent(limit = 20): Promise<MemoryHit[]> {
    const files = walkMarkdown(this.root)
      .map((f) => ({ f, m: statSync(f).mtimeMs }))
      .sort((a, b) => b.m - a.m)
      .slice(0, limit);

    return files.map(({ f }) => {
      const raw = readFileSync(f, "utf8");
      const { frontmatter, body } = parseFrontmatter(raw);
      return {
        path: relative(this.root, f).replace(/\\/g, "/"),
        kind: this.kindFromPath(f),
        title: frontmatter.title || relative(this.root, f),
        excerpt: body.trim().slice(0, 240),
        score: 0,
        tags: frontmatter.tags ?? [],
      };
    });
  }

  async hydrate(runId: string, queryHints: string[]): Promise<MemorySnapshot> {
    const limit = this.settings.hydrateLimit ?? 20;
    const hints = queryHints.filter(Boolean);
    const semantic: string[] = [];
    const episodic: string[] = [];
    const procedural: string[] = [];
    const notePaths: string[] = [];

    // Always pull ledger heads
    for (const rel of [
      "Semantic/decisions.md",
      "Semantic/learnings.md",
      "Procedures/memory-policy.md",
    ]) {
      const path = join(this.root, rel);
      if (!existsSync(path)) continue;
      const raw = readFileSync(path, "utf8");
      const { body } = parseFrontmatter(raw);
      const snippet = body.trim().slice(-1200);
      if (rel.startsWith("Semantic")) semantic.push(`[${rel}] ${snippet}`);
      else procedural.push(`[${rel}] ${snippet}`);
      notePaths.push(rel);
    }

    // Hint-driven search
    for (const hint of hints.slice(0, 5)) {
      const hits = await this.search(hint, { limit: 4 });
      for (const h of hits) {
        if (notePaths.includes(h.path)) continue;
        notePaths.push(h.path);
        const line = `[${h.path}] ${h.title}: ${h.excerpt}`;
        if (h.kind === "semantic") semantic.push(line);
        else if (h.kind === "episodic") episodic.push(line);
        else procedural.push(line);
      }
    }

    // Recent episodes
    const recent = await this.listRecent(8);
    for (const h of recent) {
      if (h.kind !== "episodic" || notePaths.includes(h.path)) continue;
      notePaths.push(h.path);
      episodic.push(`[${h.path}] ${h.title}: ${h.excerpt}`);
    }

    // Prior run note if exists
    const priorRun = join(this.root, "Episodes", "runs", `${runId}.md`);
    if (existsSync(priorRun)) {
      const raw = readFileSync(priorRun, "utf8");
      const { body } = parseFrontmatter(raw);
      episodic.unshift(`[Episodes/runs/${runId}.md] ${body.trim().slice(0, 800)}`);
    }

    return {
      semantic: semantic.slice(0, limit),
      episodic: episodic.slice(0, limit),
      procedural: procedural.slice(0, Math.min(8, limit)),
      notePaths,
    };
  }

  private kindFromPath(file: string): MemoryKind {
    const rel = relative(this.root, file).replace(/\\/g, "/");
    if (rel.startsWith("Episodes/")) return "episodic";
    if (rel.startsWith("Procedures/")) return "procedural";
    return "semantic";
  }
}

export function createMemoryBackend(
  dataDir: string,
  settings: MemorySettings,
): MemoryBackend | null {
  if (settings.kind === "none") return null;
  return new ObsidianVaultMemory(dataDir, settings);
}
