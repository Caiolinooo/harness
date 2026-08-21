import type { Spec } from "@harness/contracts";

/**
 * Lionade / Lion Code vertical: offline Unreal Engine C++ game pipeline.
 */
export const unrealCppVertical = {
  id: "unreal-cpp",
  title: "Unreal Engine 5 offline C++ game",
  systemHints: {
    prd:
      "PRD for a small but polished offline UE5 C++ game. Explicit combat/skills/save rules. " +
      "No online subsystems, analytics, or crash reporters.",
    spec:
      "Spec must be Windows/UE5 C++ oriented, offline-only, with component boundaries " +
      "(UI never calls gameplay mutators directly). Include blueprints/interfaces and save schema.",
    exec:
      "Implement C++/Blueprint tasks inside the Unreal project. Prefer blockout first, then paid packs via HITL.",
  },
  defaultStack: {
    language: "C++",
    engine: "Unreal Engine 5.7",
  },
  verifyCommands: [],
  setupConstraints: [
    "Installing Unreal Engine / Visual Studio / Epic Launcher is HITL-only (host-wide).",
    "Purchasing Marketplace assets requires purchase approval.",
    "Playtest gate required before polish/4K asset pass.",
  ],
  validateSpecExtras(spec: Spec): string[] {
    const issues: string[] = [];
    if (!spec.architecture.offlineOnly) {
      issues.push("unreal-cpp vertical requires architecture.offlineOnly=true");
    }
    if (spec.dataModel.persistence !== "unreal-save" && spec.dataModel.persistence !== "filesystem") {
      issues.push("persistence must be unreal-save or filesystem for offline game");
    }
    if (/http|rest|websocket/i.test(JSON.stringify(spec.components))) {
      issues.push("HTTP/network transport contradicts offline requirement");
    }
    return issues;
  },
};

export type UnrealCppVertical = typeof unrealCppVertical;
