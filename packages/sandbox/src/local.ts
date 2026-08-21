import { spawn } from "node:child_process";
import type {
  SandboxExecRequest,
  SandboxExecResult,
  SandboxProvider,
} from "./types.js";

/** Level-0 fallback for doctor/dev only — not for production agent code. */
export class LocalSandbox implements SandboxProvider {
  readonly name = "local";
  readonly level = 1 as const;

  constructor(private readonly workspaceRoot: string) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async exec(req: SandboxExecRequest): Promise<SandboxExecResult> {
    const started = Date.now();
    const cwd = req.cwd ?? this.workspaceRoot;
    return new Promise((resolve) => {
      const child = spawn(req.command, {
        cwd,
        env: { ...process.env, ...req.env },
        shell: true,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        stderr += "\n[harness] timeout";
      }, req.timeoutMs ?? 120_000);
      child.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          durationMs: Date.now() - started,
        });
      });
    });
  }

  async destroy(): Promise<void> {
    /* no-op */
  }
}
