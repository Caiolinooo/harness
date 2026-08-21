import type { ProvidersFile, ProviderRoleConfig } from "@harness/contracts";
import { pricingKey } from "./load.js";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostEntry {
  role: string;
  modelId: string;
  usage: TokenUsage;
  costUsd: number;
  at: string;
}

export class CostLedger {
  private entries: CostEntry[] = [];

  constructor(private readonly providers: ProvidersFile) {}

  record(
    role: string,
    config: ProviderRoleConfig,
    usage: TokenUsage,
  ): CostEntry {
    const key = pricingKey(config);
    const price = this.providers.pricing[key] ?? { input: 0, output: 0 };
    const costUsd =
      (usage.promptTokens / 1_000_000) * price.input +
      (usage.completionTokens / 1_000_000) * price.output;
    const entry: CostEntry = {
      role,
      modelId: key,
      usage,
      costUsd,
      at: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  totals(): {
    tokens: number;
    costUsd: number;
    byRole: Record<string, { tokens: number; costUsd: number }>;
  } {
    const byRole: Record<string, { tokens: number; costUsd: number }> = {};
    let tokens = 0;
    let costUsd = 0;
    for (const e of this.entries) {
      tokens += e.usage.totalTokens;
      costUsd += e.costUsd;
      const bucket = byRole[e.role] ?? { tokens: 0, costUsd: 0 };
      bucket.tokens += e.usage.totalTokens;
      bucket.costUsd += e.costUsd;
      byRole[e.role] = bucket;
    }
    return { tokens, costUsd, byRole };
  }

  all(): CostEntry[] {
    return [...this.entries];
  }
}
