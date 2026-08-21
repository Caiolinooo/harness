import { DockerSandbox } from "./docker.js";
import { FirecrackerSandbox } from "./firecracker.js";
import { LocalSandbox } from "./local.js";
import type { SandboxProvider } from "./types.js";

export type SandboxKind = "local" | "docker" | "firecracker";

export async function createSandbox(
  kind: SandboxKind,
  workspaceRoot: string,
): Promise<SandboxProvider> {
  switch (kind) {
    case "local":
      return new LocalSandbox(workspaceRoot);
    case "docker": {
      const docker = new DockerSandbox(workspaceRoot);
      if (await docker.isAvailable()) return docker;
      console.warn(
        "[harness] Docker unavailable — falling back to LocalSandbox (dev only)",
      );
      return new LocalSandbox(workspaceRoot);
    }
    case "firecracker": {
      const fc = new FirecrackerSandbox(workspaceRoot);
      if (await fc.isAvailable()) return fc;
      console.warn(
        "[harness] Firecracker unavailable — falling back to Docker/Local",
      );
      return createSandbox("docker", workspaceRoot);
    }
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown sandbox kind: ${_exhaustive}`);
    }
  }
}
