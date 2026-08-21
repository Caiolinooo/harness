import type { ToolMeta } from "@harness/contracts";

export type PolicyDecision =
  | { allow: true }
  | { allow: false; reason: string; requiresHitl: boolean };

/**
 * Least-privilege policy: privilege/network tools and host-wide setup need HITL.
 */
export class PermissionPolicy {
  decide(meta: ToolMeta): PolicyDecision {
    if (meta.requiresApproval || meta.risk === "privilege") {
      return {
        allow: false,
        reason: `Tool ${meta.name} requires human approval (${meta.risk})`,
        requiresHitl: true,
      };
    }
    if (meta.risk === "network") {
      return {
        allow: false,
        reason: `Network tool ${meta.name} blocked by default-deny`,
        requiresHitl: true,
      };
    }
    return { allow: true };
  }
}
