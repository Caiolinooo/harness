import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";
import type { ProviderRoleConfig } from "@harness/contracts";
import { createMockLanguageModel } from "./mock-model.js";

export interface ModelHandle {
  model: LanguageModelV1;
  role: string;
  config: ProviderRoleConfig;
  modelId: string;
  /** When true, harness-core must not call live providers. */
  demo: boolean;
}

function envKeyForProvider(provider: ProviderRoleConfig["provider"]): string {
  switch (provider) {
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "moonshot":
      return "MOONSHOT_API_KEY";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function hasKeyForProvider(
  provider: ProviderRoleConfig["provider"],
): boolean {
  const key = envKeyForProvider(provider);
  return Boolean(process.env[key]?.trim());
}

export function shouldUseDemo(config: ProviderRoleConfig): boolean {
  const mode = process.env.HARNESS_MODE ?? "demo";
  if (mode === "demo") return true;
  return !hasKeyForProvider(config.provider);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Open Settings in the UI or set it in .harness/settings.json`,
    );
  }
  return v;
}

export function createModelForRole(
  role: string,
  config: ProviderRoleConfig,
): ModelHandle {
  if (shouldUseDemo(config)) {
    const modelId = `demo/${config.provider}/${config.model}`;
    return {
      model: createMockLanguageModel(modelId),
      role,
      config,
      modelId,
      demo: true,
    };
  }

  switch (config.provider) {
    case "openrouter": {
      const openai = createOpenAI({
        apiKey: requireEnv("OPENROUTER_API_KEY"),
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://github.com/the-last-harness",
          "X-Title": "The Last Harness",
        },
      });
      return {
        model: openai(config.model),
        role,
        config,
        modelId: `openrouter/${config.model}`,
        demo: false,
      };
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: requireEnv("OPENAI_API_KEY"),
      });
      return {
        model: openai(config.model),
        role,
        config,
        modelId: `openai/${config.model}`,
        demo: false,
      };
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: requireEnv("ANTHROPIC_API_KEY"),
      });
      return {
        model: anthropic(config.model),
        role,
        config,
        modelId: `anthropic/${config.model}`,
        demo: false,
      };
    }
    case "moonshot": {
      const openai = createOpenAI({
        apiKey: requireEnv("MOONSHOT_API_KEY"),
        baseURL: "https://api.moonshot.ai/v1",
      });
      return {
        model: openai(config.model),
        role,
        config,
        modelId: `moonshot/${config.model}`,
        demo: false,
      };
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}
