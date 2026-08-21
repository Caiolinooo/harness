import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import {
  ProvidersFileSchema,
  type ProvidersFile,
  type ProviderRoleConfig,
} from "@harness/contracts";

export function loadProvidersFile(path: string): ProvidersFile {
  const raw = readFileSync(resolve(path), "utf8");
  const parsed = YAML.parse(raw);
  return ProvidersFileSchema.parse(parsed);
}

export function resolveRole(
  config: ProvidersFile,
  role: string,
): ProviderRoleConfig {
  const roleConfig = config.roles[role];
  if (!roleConfig) {
    throw new Error(
      `Unknown role "${role}". Available: ${Object.keys(config.roles).join(", ")}`,
    );
  }
  return {
    ...roleConfig,
    temperature: roleConfig.temperature ?? config.defaults.temperature,
    maxTokens: roleConfig.maxTokens ?? config.defaults.maxTokens,
  };
}

export function pricingKey(role: ProviderRoleConfig): string {
  return `${role.provider}/${role.model}`;
}
