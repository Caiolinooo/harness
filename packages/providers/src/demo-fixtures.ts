/**
 * Deterministic fixtures so the full pipeline runs with zero API keys (demo mode).
 */
export function demoPrd(brief: string) {
  const title =
    brief.slice(0, 48).replace(/\s+/g, " ").trim() || "Demo Product";
  return {
    version: "1.0" as const,
    title: `Demo: ${title}`,
    summary: `Auto-generated PRD (demo mode) for: ${brief}`,
    persona: "Developer using The Last Harness",
    goals: ["Deliver a working vertical slice", "Keep the system offline-capable", "Stay schema-valid"],
    nonGoals: ["Production cloud deploy", "Multi-tenant auth"],
    scope: {
      inScope: ["Core CLI/API surface", "Local persistence", "Unit tests"],
      outOfScope: ["Billing", "Realtime multiplayer"],
      assumptions: ["Node 22 available", "Running in harness demo mode"],
      openQuestions: [],
    },
    requirements: [
      {
        id: "REQ-1",
        title: "Primary workflow",
        description: "User can complete the main happy-path workflow from the brief.",
        priority: "must" as const,
        acceptanceCriteria: [
          "Happy path is documented in README",
          "At least one automated test covers core behavior",
        ],
      },
      {
        id: "REQ-2",
        title: "Local persistence",
        description: "State survives process restart via local storage.",
        priority: "must" as const,
        acceptanceCriteria: ["Data written under workspace", "Reload restores state"],
      },
      {
        id: "REQ-3",
        title: "Harness observability",
        description: "Pipeline emits artifacts consumable by the control plane.",
        priority: "should" as const,
        acceptanceCriteria: ["prd.json / spec.json / sprints.json exist after run"],
      },
    ],
    constraints: ["Prefer TypeScript", "No mandatory paid APIs in demo mode"],
    successMetrics: ["Pipeline reaches DONE", "Schema validation passes"],
    createdAt: new Date().toISOString(),
  };
}

export function demoSpec(prdTitle: string, vertical: string) {
  const offline = vertical === "unreal-cpp";
  return {
    version: "1.0" as const,
    title: `${prdTitle} Spec`,
    prdRef: "prd.json",
    architecture: {
      style: offline ? "UE5 gameplay framework modules" : "modular CLI",
      overview:
        "Demo-mode architecture with clear module boundaries and offline-first defaults.",
      offlineOnly: offline,
    },
    stack: {
      language: offline ? "C++" : "TypeScript",
      framework: offline ? undefined : "Node.js",
      engine: offline ? "Unreal Engine 5.7" : undefined,
      dependencies: offline ? ["UnrealEngine"] : ["zod", "vitest"],
    },
    components: [
      {
        id: "core",
        name: "CoreDomain",
        responsibility: "Business rules and state transitions",
        interfaces: ["IDomainService"],
        dependencies: [],
      },
      {
        id: "persist",
        name: "Persistence",
        responsibility: "Read/write local state",
        interfaces: ["IStore"],
        dependencies: ["core"],
      },
      {
        id: "ui",
        name: offline ? "HUD" : "CLI",
        responsibility: "User interaction surface",
        interfaces: ["IPresenter"],
        dependencies: ["core"],
      },
    ],
    dataModel: {
      entities: [
        {
          name: "Item",
          fields: [
            { name: "id", type: "string", required: true },
            { name: "title", type: "string", required: true },
            { name: "done", type: "boolean", required: true },
          ],
        },
      ],
      persistence: offline ? ("unreal-save" as const) : ("filesystem" as const),
    },
    boundaries: [
      "UI never mutates persistence directly",
      "No external network in default path",
    ],
    security: ["Workspace path confinement", "HITL for privilege actions"],
    testStrategy: ["Unit tests for domain", "Pipeline artifact checks"],
    glossary: [
      { term: "HITL", definition: "Human-in-the-loop approval gate" },
      { term: "Demo mode", definition: "Harness run without live LLM providers" },
    ],
  };
}

export function demoSprintPlan() {
  return {
    version: "1.0" as const,
    specRef: "spec.json",
    sprints: [
      {
        version: "1.0" as const,
        id: "S-1",
        title: "Foundation",
        goal: "Scaffold project files and domain types",
        parallelSafe: false,
        verifyCommands: ["pnpm test"],
        tasks: [
          {
            id: "T-1",
            title: "Scaffold README and package entry",
            description: "Create README.md and src/index.ts with a hello path",
            dependsOn: [],
            acceptanceCriteria: ["README exists", "src/index.ts exists"],
            estimatedFiles: ["README.md", "src/index.ts"],
          },
          {
            id: "T-2",
            title: "Domain model",
            description: "Add Item type and in-memory store",
            dependsOn: ["T-1"],
            acceptanceCriteria: ["Item type exported", "store add/list works"],
            estimatedFiles: ["src/domain.ts"],
          },
        ],
      },
      {
        version: "1.0" as const,
        id: "S-2",
        title: "CLI + tests",
        goal: "Expose commands and cover with a smoke test",
        parallelSafe: false,
        verifyCommands: ["pnpm test"],
        tasks: [
          {
            id: "T-3",
            title: "CLI commands",
            description: "Wire add/list/done commands",
            dependsOn: ["T-2"],
            acceptanceCriteria: ["Commands documented in README"],
            estimatedFiles: ["src/cli.ts"],
          },
          {
            id: "T-4",
            title: "Smoke test",
            description: "Add a vitest or node assert smoke test",
            dependsOn: ["T-3"],
            acceptanceCriteria: ["test script exits 0"],
            estimatedFiles: ["src/domain.test.ts"],
          },
        ],
      },
    ],
  };
}

export function demoValidatorFindings(severity: "ok" | "warn" | "block" = "ok") {
  return {
    blockingIssues: severity === "block" ? ["Demo blocking issue"] : [],
    suggestedFixes:
      severity === "ok"
        ? []
        : ["Clarify persistence path", "Add explicit offline boundary note"],
    severity,
  };
}

export function demoMerge() {
  return {
    acceptedFixes: [] as string[],
    rejectedFixes: ["Speculative scope expansion"],
    rationale:
      "Demo orchestrator accepted the schema-valid spec and rejected nits.",
  };
}
