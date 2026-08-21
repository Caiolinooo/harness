import { NextResponse } from "next/server";
import { createMemoryBackend } from "@harness/memory";
import { loadSettings } from "@harness/providers";
import { dataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const settings = loadSettings(dataDir());
  const memory = createMemoryBackend(dataDir(), settings.memory);
  if (!memory) {
    return NextResponse.json({
      enabled: false,
      root: null,
      notes: [],
      message: "Memory kind is none",
    });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const notes = q
    ? await memory.search(q, { limit: 40 })
    : await memory.listRecent(40);

  return NextResponse.json({
    enabled: true,
    root: memory.root,
    notes,
  });
}
