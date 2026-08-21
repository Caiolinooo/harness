import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ProviderRegistry } from "@harness/providers";
import { ProductDevelopPipeline } from "@harness/pipeline-product-develop";
import { getStore } from "@/lib/store";
import { dataDir, providersPath, repoRoot } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = getStore().listRuns(50);
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    brief?: string;
    workspace?: string;
    vertical?: string;
    autoApprove?: boolean;
    ticks?: number;
  };

  const providers = ProviderRegistry.fromFile(providersPath(), dataDir());
  const settings = providers.settings;
  const store = getStore();

  const brief = body.brief?.trim() || settings.defaults.brief;
  const vertical = body.vertical || settings.defaults.vertical;
  const workspace = resolve(
    repoRoot(),
    body.workspace || settings.defaults.workspace,
  );
  mkdirSync(workspace, { recursive: true });

  const run = store.createRun({
    pipeline: "product-develop",
    vertical,
    workspace,
    brief,
  });
  store.updateRun(run.id, { status: "running" });

  const autoApprove =
    body.autoApprove ??
    (settings.defaults.autoApprove || providers.effectiveMode === "demo");

  const pipeline = new ProductDevelopPipeline({
    runId: run.id,
    store,
    providers,
    dataDir: dataDir(),
    autoApprove,
    sandboxKind: settings.sandbox,
  });

  const ticks = [];
  const maxTicks = body.ticks ?? 40;
  for (let i = 0; i < maxTicks; i++) {
    const tick = await pipeline.tick();
    ticks.push(tick);
    if (
      tick.status === "completed" ||
      tick.status === "failed" ||
      (tick.status === "awaiting_approval" && !autoApprove)
    ) {
      break;
    }
  }

  const final = store.getRun(run.id)!;
  writeFileSync(
    join(dataDir(), "last-run.json"),
    JSON.stringify(final, null, 2),
  );

  return NextResponse.json({
    ok: true,
    run: final,
    ticks,
    mode: providers.effectiveMode,
  });
}
