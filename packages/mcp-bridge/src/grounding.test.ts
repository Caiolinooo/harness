import { describe, expect, it } from "vitest";
import { McpGroundingBridge } from "./grounding.js";
import { OntologyStore } from "./ontology.js";

describe("McpGroundingBridge", () => {
  const store = new OntologyStore([
    {
      id: "orc.grunt",
      type: "enemy",
      label: "Orc Grunt",
      aliases: ["orc", "grunt"],
      metadata: { hp: 100 },
    },
  ]);
  const bridge = new McpGroundingBridge(store);

  it("resolves aliases", () => {
    const r = bridge.resolve({ refs: ["orc", "dragon"] });
    expect(r.resolved).toHaveLength(1);
    expect(r.unresolved).toEqual(["dragon"]);
  });

  it("blocks unresolved annotate", () => {
    expect(() =>
      bridge.annotate({ text: "hi", entityIds: ["missing"] }),
    ).toThrow(/unresolved/);
  });

  it("contextualize returns entity context", () => {
    const c = bridge.contextualize({ entityIds: ["orc.grunt"], maxTokens: 500 });
    expect(c.context).toContain("orc.grunt");
  });
});
