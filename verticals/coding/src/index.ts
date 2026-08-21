import type { Spec } from "@harness/contracts";

export const codingVertical = {
  id: "coding",
  title: "Generic coding product",
  systemHints: {
    prd: "Produce a crisp product PRD for a software application. Prefer small vertical slices.",
    spec: "Spec must be implementable by coding agents with clear module boundaries and tests.",
    exec: "Implement sprint tasks with working code, tests, and README updates. Prefer TypeScript.",
  },
  defaultStack: {
    language: "TypeScript",
    framework: "Node.js",
  },
  verifyCommands: ["pnpm test", "pnpm typecheck"],
  validateSpecExtras(spec: Spec): string[] {
    const issues: string[] = [];
    if (spec.architecture.offlineOnly && spec.stack.dependencies.some((d) => /analytics|telemetry/i.test(d))) {
      issues.push("offlineOnly forbids analytics/telemetry dependencies");
    }
    return issues;
  },
};

export type CodingVertical = typeof codingVertical;
