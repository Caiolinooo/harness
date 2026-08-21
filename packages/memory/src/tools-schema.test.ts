import { describe, expect, it } from "vitest";
import { MemoryEventSchema } from "./types.js";
import { createMemoryBackend } from "./obsidian-vault.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("memory_search / memory_write schemas", () => {
  it("accepts memory_write payloads", () => {
    const parsed = MemoryEventSchema.parse({
      kind: "semantic",
      title: "Prefer vault namespace",
      content: "External vault writes stay under Harness/projectId",
      tags: ["decision"],
      entityId: "mem.namespace",
      links: ["Procedures/memory-policy"],
    });
    expect(parsed.kind).toBe("semantic");
    expect(parsed.entityId).toBe("mem.namespace");
  });

  it("search and remember match tool contracts", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "harness-mem-tools-"));
    const memory = createMemoryBackend(dataDir, {
      kind: "obsidian",
      vaultPath: "",
      projectId: "default",
      hydrateLimit: 20,
    })!;
    await memory.remember({
      kind: "semantic",
      title: "Tool write",
      content: "memory_write persisted this note",
      tags: ["learning"],
      links: [],
    });
    const hits = await memory.search("memory_write", {
      kind: "semantic",
      limit: 8,
    });
    expect(hits.some((h) => /memory_write/i.test(h.excerpt + h.title))).toBe(
      true,
    );
  });
});
