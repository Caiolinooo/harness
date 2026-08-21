#!/usr/bin/env node
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { HarnessStore } from "@harness/core";
import {
  ProviderRegistry,
  loadSettings,
  applySettingsToEnv,
  resolveEffectiveMode,
} from "@harness/providers";
import { createSandbox } from "@harness/sandbox";
import {
  ProductDevelopPipeline,
  listVerticals,
} from "@harness/pipeline-product-develop";

function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (
      existsSync(join(dir, "pnpm-workspace.yaml")) &&
      existsSync(join(dir, "providers.yaml"))
    ) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

const root = findRepoRoot();
loadEnv({ path: resolve(root, ".env") });

const dataDir = resolve(root, process.env.HARNESS_DATA_DIR ?? ".harness");
const providersPath = resolve(root, "providers.yaml");

// Always load UI/CLI persisted settings (works with empty secrets → demo mode)
const bootSettings = loadSettings(dataDir);
applySettingsToEnv({
  ...bootSettings,
  mode: resolveEffectiveMode(bootSettings),
});

function getStore(): HarnessStore {
  mkdirSync(dataDir, { recursive: true });
  return new HarnessStore(dataDir);
}

function getProviders(): ProviderRegistry {
  return ProviderRegistry.fromFile(providersPath, dataDir);
}

const program = new Command();
program
  .name("harness")
  .description("The Last Harness — multi-model agent harness CLI")
  .version("0.1.0");

program
  .command("doctor")
  .description("Check environment, providers, sandbox")
  .action(async () => {
    const providers = getProviders();
    const settings = providers.settings;
    console.log("The Last Harness — doctor\n");
    console.log(`Node: ${process.version}`);
    console.log(`CWD: ${root}`);
    console.log(`Data dir: ${dataDir}`);
    console.log(`Settings: ${join(dataDir, "settings.json")}`);
    console.log(`Mode: ${providers.effectiveMode} (configured=${settings.mode})`);
    console.log(`providers.yaml: ${existsSync(providersPath) ? "OK" : "MISSING"}`);
    console.log(`Roles: ${providers.listRoles().join(", ")}`);
    const keys = providers.hasApiKeys();
    if (keys.demo) {
      console.log("API keys: not required (demo mode) — pipeline runs offline");
      if (keys.missing.length) {
        console.log(`  (optional for live) missing: ${keys.missing.join(", ")}`);
      }
    } else if (keys.ok) {
      console.log("API keys: OK (live mode)");
    } else {
      console.log(`API keys missing for live mode: ${keys.missing.join(", ")}`);
      console.log("  Falling back would require mode=demo in Settings");
    }

    const sandbox = await createSandbox(settings.sandbox, root);
    console.log(
      `Sandbox: ${sandbox.name} (level ${sandbox.level}) available=${await sandbox.isAvailable()}`,
    );
    console.log(`Verticals: ${listVerticals().join(", ")}`);
    console.log("\nDoctor complete.");
  });

program
  .command("run")
  .description("Start a product-develop pipeline run")
  .option("-w, --workspace <path>", "Target workspace path")
  .option("-p, --pipeline <name>", "Pipeline name", "product-develop")
  .option("-v, --vertical <id>", "Vertical id")
  .option("-b, --brief <text>", "Product brief")
  .option("--brief-file <path>", "Read brief from file")
  .option("--auto-approve", "Auto-approve HITL gates", false)
  .option("--ticks <n>", "Max ticks to advance now", "40")
  .action(async (opts) => {
    if (opts.pipeline !== "product-develop") {
      throw new Error(`Unsupported pipeline: ${opts.pipeline}`);
    }
    const providers = getProviders();
    const settings = providers.settings;
    const brief =
      opts.brief ??
      (opts.briefFile
        ? readFileSync(resolve(opts.briefFile), "utf8")
        : settings.defaults.brief);
    const workspace = resolve(opts.workspace ?? settings.defaults.workspace);
    const vertical = opts.vertical ?? settings.defaults.vertical;
    mkdirSync(workspace, { recursive: true });

    const store = getStore();
    const run = store.createRun({
      pipeline: opts.pipeline,
      vertical,
      workspace,
      brief,
    });
    store.updateRun(run.id, { status: "running" });

    const autoApprove =
      Boolean(opts.autoApprove) ||
      settings.defaults.autoApprove ||
      providers.effectiveMode === "demo";

    const pipeline = new ProductDevelopPipeline({
      runId: run.id,
      store,
      providers,
      dataDir,
      autoApprove,
      sandboxKind: settings.sandbox,
    });

    console.log(`Run started: ${run.id}`);
    console.log(`Mode: ${providers.effectiveMode}`);
    const maxTicks = Number(opts.ticks);
    for (let i = 0; i < maxTicks; i++) {
      const tick = await pipeline.tick();
      console.log(`[tick ${i + 1}] ${tick.status} @ ${tick.phase} — ${tick.message}`);
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
      join(dataDir, "last-run.json"),
      JSON.stringify(final, null, 2),
    );
    console.log(`\nRun ${final.id} → ${final.status} / ${final.phase}`);
    console.log(`Tokens: ${final.tokensUsed} | Cost: $${final.costUsd.toFixed(4)}`);
    if (final.status === "awaiting_approval") {
      const pending = store.listPendingApprovals(final.id);
      for (const p of pending) {
        console.log(`  HITL ${p.id}: ${p.title}`);
      }
      console.log(`Approve with: pnpm harness -- approve <id>`);
    }
    store.close();
  });

program
  .command("approve")
  .description("Approve a pending HITL gate")
  .argument("<approvalId>", "Approval id")
  .option("-n, --note <text>", "Resolution note")
  .action(async (approvalId, opts) => {
    const store = getStore();
    const approval = store.resolveApproval(approvalId, "approved", opts.note);
    console.log(`Approved ${approval.id} (${approval.kind}) for run ${approval.runId}`);

    const providers = getProviders();
    const pipeline = new ProductDevelopPipeline({
      runId: approval.runId,
      store,
      providers,
      dataDir,
      sandboxKind: providers.settings.sandbox,
    });
    for (let i = 0; i < 40; i++) {
      const tick = await pipeline.tick();
      console.log(`[tick ${i + 1}] ${tick.status} @ ${tick.phase} — ${tick.message}`);
      if (
        tick.status === "completed" ||
        tick.status === "failed" ||
        tick.status === "awaiting_approval"
      ) {
        break;
      }
    }
    store.close();
  });

program
  .command("reject")
  .description("Reject a pending HITL gate")
  .argument("<approvalId>", "Approval id")
  .option("-n, --note <text>", "Resolution note")
  .action(async (approvalId, opts) => {
    const store = getStore();
    const approval = store.resolveApproval(approvalId, "rejected", opts.note);
    store.updateRun(approval.runId, {
      status: "failed",
      phase: "FAILED",
      error: `Rejected ${approval.kind}: ${opts.note ?? ""}`,
    });
    console.log(`Rejected ${approval.id}`);
    store.close();
  });

program
  .command("status")
  .description("Show run status")
  .argument("[runId]", "Run id (defaults to last)")
  .action(async (runId) => {
    const store = getStore();
    const id =
      runId ??
      (existsSync(join(dataDir, "last-run.json"))
        ? JSON.parse(readFileSync(join(dataDir, "last-run.json"), "utf8")).id
        : null);
    if (!id) {
      console.log("No runs yet.");
      store.close();
      return;
    }
    const run = store.getRun(id);
    console.log(JSON.stringify(run, null, 2));
    console.log("Pending approvals:", store.listPendingApprovals(id));
    console.log("Artifacts:", store.listArtifacts(id));
    store.close();
  });

program
  .command("list")
  .description("List recent runs")
  .action(() => {
    const store = getStore();
    for (const r of store.listRuns(20)) {
      console.log(
        `${r.id.slice(0, 8)}  ${r.status.padEnd(18)}  ${r.phase.padEnd(22)}  ${r.vertical}  $${r.costUsd.toFixed(3)}`,
      );
    }
    store.close();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
