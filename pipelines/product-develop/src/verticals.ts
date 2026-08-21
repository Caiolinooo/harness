import { codingVertical } from "@harness/vertical-coding";
import { unrealCppVertical } from "@harness/vertical-unreal-cpp";
import type { Spec } from "@harness/contracts";

export interface Vertical {
  id: string;
  title: string;
  systemHints: { prd: string; spec: string; exec: string };
  defaultStack: { language: string; framework?: string; engine?: string };
  verifyCommands: string[];
  setupConstraints?: string[];
  validateSpecExtras: (spec: Spec) => string[];
}

const registry: Record<string, Vertical> = {
  coding: codingVertical,
  "unreal-cpp": unrealCppVertical,
};

export function getVertical(id: string): Vertical {
  const v = registry[id];
  if (!v) {
    throw new Error(
      `Unknown vertical "${id}". Available: ${Object.keys(registry).join(", ")}`,
    );
  }
  return v;
}

export function listVerticals(): string[] {
  return Object.keys(registry);
}
