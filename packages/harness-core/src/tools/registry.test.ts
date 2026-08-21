import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./registry.js";

describe("ToolRegistry", () => {
  it("rejects invalid schemas", async () => {
    const reg = new ToolRegistry();
    reg.register({
      meta: {
        name: "add",
        description: "add numbers",
        risk: "read",
        requiresApproval: false,
      },
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => a + b,
    });
    const bad = await reg.invoke("add", { a: "x", b: 1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.schemaPass).toBe(false);
  });

  it("executes valid tools", async () => {
    const reg = new ToolRegistry();
    reg.register({
      meta: {
        name: "add",
        description: "add numbers",
        risk: "read",
        requiresApproval: false,
      },
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => a + b,
    });
    const ok = await reg.invoke("add", { a: 2, b: 3 });
    expect(ok).toEqual({ ok: true, result: 5 });
  });

  it("blocks requiresApproval tools with requiresHitl", async () => {
    const reg = new ToolRegistry();
    reg.register({
      meta: {
        name: "danger",
        description: "needs approval",
        risk: "read",
        requiresApproval: true,
      },
      inputSchema: z.object({}),
      execute: () => "ok",
    });
    const res = await reg.invoke("danger", {});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.schemaPass).toBe(true);
      expect(res.requiresHitl).toBe(true);
    }
  });
});
