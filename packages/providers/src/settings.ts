import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

export const MemorySettingsSchema = z.object({
  kind: z.enum(["none", "obsidian"]).default("obsidian"),
  vaultPath: z.string().default(""),
  projectId: z.string().default("default"),
  hydrateLimit: z.number().int().positive().default(20),
});

export const HarnessSettingsSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  sandbox: z.enum(["local", "docker", "firecracker"]).default("local"),
  secrets: z
    .object({
      OPENROUTER_API_KEY: z.string().default(""),
      OPENAI_API_KEY: z.string().default(""),
      ANTHROPIC_API_KEY: z.string().default(""),
      MOONSHOT_API_KEY: z.string().default(""),
    })
    .default({}),
  defaults: z
    .object({
      vertical: z.string().default("coding"),
      workspace: z.string().default("./examples/demo-app"),
      autoApprove: z.boolean().default(false),
      brief: z
        .string()
        .default("Build a small TypeScript todo CLI with add/list/done and tests."),
    })
    .default({}),
  memory: MemorySettingsSchema.default({}),
});

export type HarnessSettings = z.infer<typeof HarnessSettingsSchema>;

export function defaultSettings(): HarnessSettings {
  return HarnessSettingsSchema.parse({});
}

export function settingsPath(dataDir: string): string {
  return join(resolve(dataDir), "settings.json");
}

export function loadSettings(dataDir: string): HarnessSettings {
  const path = settingsPath(dataDir);
  if (!existsSync(path)) {
    const settings = defaultSettings();
    saveSettings(dataDir, settings);
    return settings;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const safe =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const defaults = defaultSettings();
    return HarnessSettingsSchema.parse({
      ...defaults,
      ...safe,
      secrets: { ...defaults.secrets, ...(safe.secrets ?? {}) },
      defaults: { ...defaults.defaults, ...(safe.defaults ?? {}) },
      memory: { ...defaults.memory, ...(safe.memory ?? {}) },
    });
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(
  dataDir: string,
  settings: HarnessSettings,
): HarnessSettings {
  const parsed = HarnessSettingsSchema.parse(settings);
  const path = settingsPath(dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

/** Push saved secrets + mode into process.env for the current process. */
export function applySettingsToEnv(settings: HarnessSettings): void {
  process.env.HARNESS_MODE = settings.mode;
  process.env.HARNESS_DEFAULT_SANDBOX = settings.sandbox;
  for (const [key, value] of Object.entries(settings.secrets)) {
    if (value && value.trim()) {
      process.env[key] = value.trim();
    }
  }
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

export function publicSettingsView(settings: HarnessSettings): {
  mode: HarnessSettings["mode"];
  sandbox: HarnessSettings["sandbox"];
  defaults: HarnessSettings["defaults"];
  memory: HarnessSettings["memory"];
  secrets: Record<string, { set: boolean; masked: string }>;
  liveReady: boolean;
} {
  const secretKeys = [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "MOONSHOT_API_KEY",
  ] as const;
  const secrets = Object.fromEntries(
    secretKeys.map((k) => {
      const v = settings.secrets[k] || process.env[k] || "";
      return [k, { set: Boolean(v), masked: maskSecret(v) }];
    }),
  );
  const liveReady = Boolean(
    settings.secrets.OPENROUTER_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      settings.secrets.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      settings.secrets.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      settings.secrets.MOONSHOT_API_KEY ||
      process.env.MOONSHOT_API_KEY,
  );
  return {
    mode: settings.mode,
    sandbox: settings.sandbox,
    defaults: settings.defaults,
    memory: settings.memory,
    secrets,
    liveReady,
  };
}

export function resolveEffectiveMode(settings: HarnessSettings): "demo" | "live" {
  if (settings.mode === "demo") return "demo";
  const view = publicSettingsView(settings);
  return view.liveReady ? "live" : "demo";
}
