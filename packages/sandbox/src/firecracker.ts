import type {
  SandboxExecRequest,
  SandboxExecResult,
  SandboxProvider,
} from "./types.js";

/**
 * Level-3 MicroVM adapter stub (CubeSandbox / Firecracker).
 * Requires Linux or WSL2 with KVM — not available natively on Windows host.
 */
export class FirecrackerSandbox implements SandboxProvider {
  readonly name = "firecracker";
  readonly level = 3 as const;

  constructor(private readonly workspaceRoot: string) {
    void this.workspaceRoot;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async exec(_req: SandboxExecRequest): Promise<SandboxExecResult> {
    throw new Error(
      "Firecracker/CubeSandbox requires Linux/WSL2 with KVM. " +
        "Use DockerSandbox on Windows, or deploy the harness worker on Linux.",
    );
  }

  async destroy(): Promise<void> {
    /* no-op */
  }
}
