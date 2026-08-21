import { HarnessStore } from "@harness/core";
import { dataDir } from "./paths";

let singleton: HarnessStore | null = null;

process.on("beforeExit", () => {
  singleton?.close();
});

export function getStore(): HarnessStore {
  if (!singleton) {
    let dir: string;
    try {
      dir = dataDir();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Harness data directory unavailable: ${reason}`);
    }
    singleton = new HarnessStore(dir);
  }
  return singleton;
}
