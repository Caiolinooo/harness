import { z } from "zod";
import type { SandboxProvider } from "@harness/sandbox";
import type { ToolRegistry } from "./registry.js";

export function registerExecTool(
  registry: ToolRegistry,
  sandbox: SandboxProvider,
): void {
  registry.register({
    meta: {
      name: "run_command",
      description:
        "Execute a shell command inside the sandbox (workspace-scoped, network policy applied)",
      risk: "exec",
      requiresApproval: false,
    },
    inputSchema: z.object({
      command: z.string().min(1),
      timeoutMs: z.number().int().positive().default(120_000),
    }),
    execute: async ({ command, timeoutMs }) => {
      const result = await sandbox.exec({ command, timeoutMs });
      return {
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, 20_000),
        stderr: result.stderr.slice(0, 10_000),
        durationMs: result.durationMs,
      };
    },
  });
}
