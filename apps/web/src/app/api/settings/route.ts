import { NextResponse } from "next/server";
import {
  loadSettings,
  saveSettings,
  publicSettingsView,
  applySettingsToEnv,
  resolveEffectiveMode,
  HarnessSettingsSchema,
} from "@harness/providers";
import { dataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = loadSettings(dataDir());
  applySettingsToEnv({
    ...settings,
    mode: resolveEffectiveMode(settings),
  });
  return NextResponse.json({
    settings: publicSettingsView(settings),
    effectiveMode: resolveEffectiveMode(settings),
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const current = loadSettings(dataDir());

  const nextSecrets = { ...current.secrets };
  if (body?.secrets && typeof body.secrets === "object") {
    for (const [key, value] of Object.entries(body.secrets)) {
      if (!(key in nextSecrets)) continue;
      if (value === null || value === "__CLEAR__") {
        (nextSecrets as Record<string, string>)[key] = "";
      } else if (typeof value === "string" && value.length > 0 && !value.includes("••")) {
        (nextSecrets as Record<string, string>)[key] = value;
      }
    }
  }

  const merged = HarnessSettingsSchema.parse({
    mode: body.mode ?? current.mode,
    sandbox: body.sandbox ?? current.sandbox,
    secrets: nextSecrets,
    defaults: {
      ...current.defaults,
      ...(body.defaults ?? {}),
    },
    memory: {
      ...current.memory,
      ...(body.memory ?? {}),
    },
  });

  const saved = saveSettings(dataDir(), merged);
  applySettingsToEnv({
    ...saved,
    mode: resolveEffectiveMode(saved),
  });

  return NextResponse.json({
    ok: true,
    settings: publicSettingsView(saved),
    effectiveMode: resolveEffectiveMode(saved),
  });
}
