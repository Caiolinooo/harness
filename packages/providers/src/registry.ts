import type { ProvidersFile } from "@harness/contracts";
import { CostLedger } from "./cost.js";
import {
  createModelForRole,
  hasKeyForProvider,
  type ModelHandle,
} from "./factory.js";
import { loadProvidersFile, resolveRole } from "./load.js";
import {
  applySettingsToEnv,
  loadSettings,
  resolveEffectiveMode,
  type HarnessSettings,
} from "./settings.js";

export class ProviderRegistry {
  readonly ledger: CostLedger;
  readonly settings: HarnessSettings;
  readonly effectiveMode: "demo" | "live";

  constructor(
    readonly config: ProvidersFile,
    readonly configPath: string,
    settings: HarnessSettings,
  ) {
    this.settings = settings;
    this.effectiveMode = resolveEffectiveMode(settings);
    applySettingsToEnv({
      ...settings,
      mode: this.effectiveMode,
    });
    this.ledger = new CostLedger(config);
  }

  static fromFile(providersPath: string, dataDir: string): ProviderRegistry {
    const settings = loadSettings(dataDir);
    return new ProviderRegistry(
      loadProvidersFile(providersPath),
      providersPath,
      settings,
    );
  }

  listRoles(): string[] {
    return Object.keys(this.config.roles);
  }

  get(role: string): ModelHandle {
    const roleConfig = resolveRole(this.config, role);
    return createModelForRole(role, roleConfig);
  }

  hasApiKeys(): { ok: boolean; missing: string[]; demo: boolean } {
    const needed = new Set<string>();
    for (const role of Object.values(this.config.roles)) {
      if (!hasKeyForProvider(role.provider)) {
        switch (role.provider) {
          case "openrouter":
            needed.add("OPENROUTER_API_KEY");
            break;
          case "openai":
            needed.add("OPENAI_API_KEY");
            break;
          case "anthropic":
            needed.add("ANTHROPIC_API_KEY");
            break;
          case "moonshot":
            needed.add("MOONSHOT_API_KEY");
            break;
          default: {
            const _exhaustive: never = role.provider;
            void _exhaustive;
          }
        }
      }
    }
    return {
      ok: needed.size === 0,
      missing: [...needed],
      demo: this.effectiveMode === "demo",
    };
  }
}
