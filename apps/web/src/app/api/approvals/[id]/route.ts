import { NextResponse } from "next/server";
import { ProviderRegistry } from "@harness/providers";
import { ProductDevelopPipeline } from "@harness/pipeline-product-develop";
import { getStore } from "@/lib/store";
import { dataDir, providersPath } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { action: "approve" | "reject"; note?: string };
  const store = getStore();

  if (body.action === "reject") {
    const approval = store.resolveApproval(id, "rejected", body.note);
    store.updateRun(approval.runId, {
      status: "failed",
      phase: "FAILED",
      error: `Rejected ${approval.kind}`,
    });
    return NextResponse.json({ ok: true, approval });
  }

  const approval = store.resolveApproval(id, "approved", body.note);
  const providers = ProviderRegistry.fromFile(providersPath(), dataDir());
  const pipeline = new ProductDevelopPipeline({
    runId: approval.runId,
    store,
    providers,
    dataDir: dataDir(),
    sandboxKind: providers.settings.sandbox,
  });

  const ticks = [];
  for (let i = 0; i < 40; i++) {
    const tick = await pipeline.tick();
    ticks.push(tick);
    if (
      tick.status === "completed" ||
      tick.status === "failed" ||
      tick.status === "awaiting_approval"
    ) {
      break;
    }
  }

  return NextResponse.json({ ok: true, approval, ticks });
}
