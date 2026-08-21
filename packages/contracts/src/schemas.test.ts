import { describe, expect, it } from "vitest";
import { PrdSchema } from "./prd.js";
import { SpecSchema } from "./spec.js";
import { SprintPlanSchema } from "./sprint.js";
import { ToolMetaSchema } from "./tools.js";

describe("contracts schemas", () => {
  it("parses a minimal valid PRD", () => {
    const prd = {
      version: "1.0" as const,
      title: "Todo CLI",
      summary: "A minimal offline TypeScript CLI for personal todos.",
      persona: "Developer who lives in the terminal",
      goals: ["Add todos", "List todos"],
      scope: {
        inScope: ["CLI commands"],
        outOfScope: [],
        assumptions: [],
        openQuestions: [],
      },
      requirements: [
        {
          id: "REQ-1",
          title: "Add todo",
          description: "User can add a todo with text",
          priority: "must" as const,
          acceptanceCriteria: ["Command persists item"],
        },
      ],
    };
    expect(PrdSchema.parse(prd)).toMatchObject({ title: "Todo CLI" });
  });

  it("parses a minimal valid spec", () => {
    const spec = {
      version: "1.0" as const,
      title: "Todo CLI Spec",
      prdRef: "prd.json",
      architecture: {
        style: "modular CLI",
        overview: "Offline-first CLI architecture.",
      },
      stack: {
        language: "TypeScript",
      },
      components: [
        {
          id: "core",
          name: "CoreDomain",
          responsibility: "Business rules",
        },
      ],
      dataModel: {
        entities: [],
        persistence: "filesystem" as const,
      },
    };
    expect(SpecSchema.parse(spec)).toMatchObject({ title: "Todo CLI Spec" });
  });

  it("parses a minimal sprint plan", () => {
    const plan = {
      version: "1.0" as const,
      specRef: "spec.json",
      sprints: [
        {
          version: "1.0" as const,
          id: "S-1",
          title: "Foundation",
          goal: "Scaffold project",
          tasks: [
            {
              id: "T-1",
              title: "Init repo",
              description: "Create package layout",
              acceptanceCriteria: ["Build passes"],
            },
          ],
        },
      ],
    };
    expect(SprintPlanSchema.parse(plan)).toMatchObject({ specRef: "spec.json" });
  });

  it("rejects invalid tool names", () => {
    expect(() =>
      ToolMetaSchema.parse({
        name: "Invalid-Tool",
        description: "Bad name",
        risk: "read",
      }),
    ).toThrow();
  });
});
