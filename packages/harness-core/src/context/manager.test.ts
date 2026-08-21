import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryBackend } from "@harness/memory";
import { HarnessStore } from "../state/store.js";
import { ContextManager } from "./manager.js";

describe("ContextManager", () => {
  it("offloads large tool output and compacts memory", () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-ctx-"));
    const store = new HarnessStore(dir);
    const run = store.createRun({
      pipeline: "product-develop",
      vertical: "coding",
      workspace: dir,
      brief: "test",
    });
    const ctx = new ContextManager(store, run.id, join(dir, "art"), 5);
    ctx.addSemantic("entity:todo");
    const big = "x".repeat(10_000);
    const summary = ctx.offloadToolOutput("read_file", big, 1000);
    expect(summary).toContain("offloaded");
    expect(summary.length).toBeLessThan(big.length);
    for (let i = 0; i < 10; i++) ctx.pushWorking(`w-${i}`);
    const compact = ctx.compact(2000);
    expect(compact).toContain("Semantic");
    expect(compact.length).toBeLessThanOrEqual(2000);
    store.close();
  });

  it("hydrates semantic from Obsidian vault into compact()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-ctx-mem-"));
    const store = new HarnessStore(dir);
    const memory = createMemoryBackend(dir, {
      kind: "obsidian",
      vaultPath: "",
      projectId: "default",
      hydrateLimit: 20,
    })!;
    await memory.remember({
      kind: "semantic",
      title: "Cross-run decision",
      content: "Always prefer JSON store for portable Next.js",
      tags: ["decision"],
      links: [],
    });
    const run = store.createRun({
      pipeline: "product-develop",
      vertical: "coding",
      workspace: dir,
      brief: "test",
    });
    const ctx = new ContextManager({
      store,
      runId: run.id,
      artifactDir: join(dir, "art"),
      memory,
    });
    await ctx.hydrateFromMemory(["JSON"]);
    const compact = ctx.compact();
    expect(compact).toMatch(/JSON store/i);
    store.close();
  });
});
