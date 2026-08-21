import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export function repoRoot(): string {
  let dir = resolve(process.cwd());
  for (;;) {
    if (
      existsSync(join(dir, "pnpm-workspace.yaml")) &&
      existsSync(join(dir, "providers.yaml"))
    ) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      throw new Error(
        "The Last Harness repo root not found — run inside the monorepo",
      );
    }
    dir = parent;
  }
}

export function dataDir(): string {
  return resolve(repoRoot(), process.env.HARNESS_DATA_DIR ?? ".harness");
}

export function providersPath(): string {
  return resolve(repoRoot(), "providers.yaml");
}
