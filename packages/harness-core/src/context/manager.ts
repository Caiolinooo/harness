import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { MemoryBackend, MemorySnapshot } from "@harness/memory";
import type { HarnessStore } from "../state/store.js";

export interface ContextBundle {
  system: string;
  working: string[];
  episodic: string[];
  semantic: string[];
}

export interface ContextManagerOptions {
  store: HarnessStore;
  runId: string;
  artifactDir: string;
  maxWorking?: number;
  memory?: MemoryBackend | null;
}

/**
 * Separates working / episodic / semantic memory with eviction + tool-output offload.
 * Optional MemoryBackend (Obsidian vault) hydrates semantic/episodic across runs.
 */
export class ContextManager {
  private working: string[] = [];
  private semantic: string[] = [];
  private procedural: string[] = [];
  private readonly store: HarnessStore;
  private readonly runId: string;
  private readonly artifactDir: string;
  private readonly maxWorking: number;
  private readonly memory: MemoryBackend | null;

  constructor(
    storeOrOpts: HarnessStore | ContextManagerOptions,
    runId?: string,
    artifactDir?: string,
    maxWorking = 40,
  ) {
    if (
      typeof storeOrOpts === "object" &&
      storeOrOpts !== null &&
      "store" in storeOrOpts &&
      "runId" in storeOrOpts &&
      "artifactDir" in storeOrOpts
    ) {
      const opts = storeOrOpts;
      this.store = opts.store;
      this.runId = opts.runId;
      this.artifactDir = opts.artifactDir;
      this.maxWorking = opts.maxWorking ?? 40;
      this.memory = opts.memory ?? null;
    } else {
      this.store = storeOrOpts as HarnessStore;
      this.runId = runId!;
      this.artifactDir = artifactDir!;
      this.maxWorking = maxWorking;
      this.memory = null;
    }
    mkdirSync(this.artifactDir, { recursive: true });
  }

  seedSnapshot(snap: MemorySnapshot): void {
    for (const s of snap.semantic) this.semantic.push(s);
    for (const p of snap.procedural) this.procedural.push(p);
    for (const e of snap.episodic) {
      this.store.addEpisode(this.runId, `[vault] ${e.slice(0, 500)}`);
    }
  }

  async hydrateFromMemory(queryHints: string[] = []): Promise<MemorySnapshot | null> {
    if (!this.memory) return null;
    const snap = await this.memory.hydrate(this.runId, queryHints);
    this.seedSnapshot(snap);
    return snap;
  }

  pushWorking(item: string): void {
    this.working.push(item);
    while (this.working.length > this.maxWorking) {
      const evicted = this.working.shift();
      if (evicted) {
        this.store.addEpisode(
          this.runId,
          `[evicted-working] ${evicted.slice(0, 500)}`,
        );
        void this.memory?.remember({
          kind: "episodic",
          title: "Evicted working item",
          content: evicted.slice(0, 800),
          tags: ["eviction", "working"],
          runId: this.runId,
          links: [],
        });
      }
    }
  }

  addSemantic(fact: string, title = "Semantic fact"): void {
    this.semantic.push(fact);
    void this.memory?.remember({
      kind: "semantic",
      title,
      content: fact,
      tags: ["semantic"],
      runId: this.runId,
      links: [],
    });
  }

  /** Offload large tool outputs to filesystem; keep head+tail in working memory. */
  offloadToolOutput(toolName: string, output: string, threshold = 4000): string {
    if (output.length <= threshold) return output;
    const file = join(
      this.artifactDir,
      `tool-${toolName}-${Date.now()}.txt`,
    );
    writeFileSync(file, output, "utf8");
    const head = output.slice(0, 800);
    const tail = output.slice(-800);
    const summary = `${head}\n…[offloaded ${output.length} chars → ${file}]\n${tail}`;
    this.pushWorking(`tool:${toolName} offloaded to ${file}`);
    return summary;
  }

  compact(maxChars = 12_000): string {
    const episodic = this.store.listEpisodes(this.runId, 12);
    const parts = [
      "## Semantic",
      ...this.semantic.slice(-20),
      "## Procedural",
      ...this.procedural.slice(-8),
      "## Episodic",
      ...episodic,
      "## Working",
      ...this.working.slice(-15),
    ];
    let text = parts.join("\n");
    if (text.length > maxChars) {
      text = text.slice(-maxChars);
    }
    return text;
  }

  bundle(system: string): ContextBundle {
    return {
      system,
      working: [...this.working],
      episodic: this.store.listEpisodes(this.runId, 12),
      semantic: [...this.semantic],
    };
  }
}
