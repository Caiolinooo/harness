import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { z } from "zod";
import type { ToolRegistry } from "./registry.js";

function assertInside(workspace: string, target: string): string {
  const root = resolve(workspace);
  const full = resolve(root, target);
  const rel = relative(root, full);
  if (rel.startsWith("..") || rel.includes("..")) {
    throw new Error(`Path escapes workspace: ${target}`);
  }
  return full;
}

export function registerFsTools(registry: ToolRegistry, workspace: string): void {
  registry.register({
    meta: {
      name: "read_file",
      description: "Read a UTF-8 text file from the workspace",
      risk: "read",
      requiresApproval: false,
    },
    inputSchema: z.object({
      path: z.string(),
      maxChars: z.number().int().positive().default(50_000),
    }),
    execute: ({ path, maxChars }) => {
      const full = assertInside(workspace, path);
      if (!existsSync(full)) throw new Error(`File not found: ${path}`);
      const content = readFileSync(full, "utf8");
      return content.length > maxChars
        ? content.slice(0, maxChars) + "\n…[truncated]"
        : content;
    },
  });

  registry.register({
    meta: {
      name: "write_file",
      description: "Write a UTF-8 text file inside the workspace",
      risk: "write",
      requiresApproval: false,
    },
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: ({ path, content }) => {
      const full = assertInside(workspace, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
      return { ok: true, path };
    },
  });

  registry.register({
    meta: {
      name: "list_dir",
      description: "List files in a workspace directory",
      risk: "read",
      requiresApproval: false,
    },
    inputSchema: z.object({
      path: z.string().default("."),
    }),
    execute: ({ path }) => {
      const full = assertInside(workspace, path);
      if (!existsSync(full)) throw new Error(`Dir not found: ${path}`);
      return readdirSync(full).map((name) => {
        const s = statSync(join(full, name));
        return { name, type: s.isDirectory() ? "dir" : "file", size: s.size };
      });
    },
  });
}
