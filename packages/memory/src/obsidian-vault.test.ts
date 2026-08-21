import { describe, expect, it } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMemoryBackend,
  ObsidianVaultMemory,
} from "./obsidian-vault.js";

describe("ObsidianVaultMemory", () => {
  it("creates vault layout and remembers across hydrate", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "harness-mem-"));
    const mem = new ObsidianVaultMemory(dataDir, {
      kind: "obsidian",
      vaultPath: "",
      projectId: "default",
      hydrateLimit: 20,
    });

    expect(existsSync(join(mem.root, "index.md"))).toBe(true);
    expect(existsSync(join(mem.root, "Semantic", "decisions.md"))).toBe(true);

    await mem.remember({
      kind: "semantic",
      title: "Use SQLite-free JSON store",
      content: "Prefer portable JSON store over better-sqlite3 in Next.js.",
      tags: ["decision", "architecture"],
      runId: "run-1",
      links: ["Procedures/coding"],
    });

    await mem.remember({
      kind: "episodic",
      title: "PRD approved",
      content: "User approved PRD for todo CLI.",
      tags: ["prd"],
      runId: "run-1",
      links: [],
    });

    const hits = await mem.search("JSON store");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.kind).toBe("semantic");

    const snap = await mem.hydrate("run-2", ["JSON", "todo"]);
    expect(snap.semantic.some((s) => /JSON store/i.test(s))).toBe(true);
    expect(snap.episodic.length).toBeGreaterThan(0);

    const decisions = readFileSync(
      join(mem.root, "Semantic", "decisions.md"),
      "utf8",
    );
    expect(decisions).toContain("SQLite-free");
  });

  it("namespaces external vault under Harness/projectId", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "harness-mem-data-"));
    const external = mkdtempSync(join(tmpdir(), "obsidian-vault-"));
    const mem = new ObsidianVaultMemory(dataDir, {
      kind: "obsidian",
      vaultPath: external,
      projectId: "lionade",
      hydrateLimit: 10,
    });
    expect(mem.root.replace(/\\/g, "/")).toContain("Harness/lionade");
    await mem.remember({
      kind: "procedural",
      title: "hitl-gate",
      content: "Always HITL for asset purchases.",
      tags: ["procedural"],
      links: [],
    });
    expect(existsSync(join(mem.root, "Procedures"))).toBe(true);
  });

  it("createMemoryBackend returns null when kind is none", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "harness-mem-none-"));
    expect(
      createMemoryBackend(dataDir, {
        kind: "none",
        vaultPath: "",
        projectId: "default",
        hydrateLimit: 20,
      }),
    ).toBeNull();
  });
});
