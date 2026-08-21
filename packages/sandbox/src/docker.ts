import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type {
  NetworkPolicy,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxProvider,
} from "./types.js";

const DEFAULT_POLICY: NetworkPolicy = {
  denyPrivateSubnets: true,
  allowHosts: [],
};

/**
 * Level-1 Docker sandbox: mounts only the workspace, optional --network none.
 * On Windows uses Docker Desktop. Production should prefer gVisor/MicroVM.
 */
export class DockerSandbox implements SandboxProvider {
  readonly name = "docker";
  readonly level = 1 as const;
  private containerId?: string;

  constructor(
    private readonly workspaceRoot: string,
    private readonly image = "node:22-bookworm-slim",
    private readonly policy: NetworkPolicy = DEFAULT_POLICY,
  ) {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolveAvail) => {
      const child = spawn("docker", ["version", "--format", "{{.Server.Version}}"], {
        shell: true,
        windowsHide: true,
      });
      child.on("close", (code) => resolveAvail(code === 0));
      child.on("error", () => resolveAvail(false));
    });
  }

  private networkArgs(): string[] {
    if (this.policy.denyPrivateSubnets && this.policy.allowHosts.length === 0) {
      return ["--network", "none"];
    }
    return [];
  }

  async exec(req: SandboxExecRequest): Promise<SandboxExecResult> {
    const started = Date.now();
    const hostPath = resolve(this.workspaceRoot).replace(/\\/g, "/");
    const args = [
      "run",
      "--rm",
      ...this.networkArgs(),
      "-v",
      `${hostPath}:/workspace:rw`,
      "-w",
      "/workspace",
      this.image,
      "bash",
      "-lc",
      req.command,
    ];

    return new Promise((resolveResult) => {
      const child = spawn("docker", args, {
        shell: false,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        stderr += "\n[harness] docker timeout";
      }, req.timeoutMs ?? 180_000);
      child.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolveResult({
          exitCode: code ?? 1,
          stdout,
          stderr,
          durationMs: Date.now() - started,
        });
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolveResult({
          exitCode: 1,
          stdout,
          stderr: `${stderr}\n${err.message}`,
          durationMs: Date.now() - started,
        });
      });
    });
  }

  async destroy(): Promise<void> {
    if (!this.containerId) return;
    await new Promise<void>((resolveDone) => {
      const child = spawn("docker", ["rm", "-f", this.containerId!], {
        shell: true,
        windowsHide: true,
      });
      child.on("close", () => resolveDone());
      child.on("error", () => resolveDone());
    });
    this.containerId = undefined;
  }
}
