import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  PrdSchema,
  SpecSchema,
  SprintPlanSchema,
  type PipelinePhase,
  type Prd,
  type Spec,
  type SprintPlan,
} from "@harness/contracts";
import {
  ContextManager,
  HarnessStore,
  LifecycleHooks,
  Supervisor,
  ToolRegistry,
  generateStructured,
  installRalphLoop,
  registerExecTool,
  registerFsTools,
  runAgentLoop,
} from "@harness/core";
import { SpanCollector } from "@harness/observability";
import type { ProviderRegistry } from "@harness/providers";
import { createSandbox, type SandboxKind, type SandboxProvider } from "@harness/sandbox";
import {
  McpGroundingBridge,
  OntologyStore,
  type OntologyEntity,
} from "@harness/mcp-bridge";
import {
  createMemoryBackend,
  type MemoryBackend,
  type MemorySnapshot,
} from "@harness/memory";
import { z } from "zod";
import { getVertical } from "./verticals.js";

export interface PipelineOptions {
  runId: string;
  store: HarnessStore;
  providers: ProviderRegistry;
  dataDir: string;
  validatorRounds?: number;
  /** When true, stop at HITL instead of failing. */
  pauseOnHitl?: boolean;
  /** Auto-approve HITL (dev/demo only). */
  autoApprove?: boolean;
  sandboxKind?: SandboxKind;
}

function artifactRoot(dataDir: string, runId: string): string {
  const dir = join(dataDir, "runs", runId, "artifacts");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

function loadOntologyStore(workspace: string): OntologyStore {
  const ontologyPath = join(workspace, "docs/ontology.json");
  if (!existsSync(ontologyPath)) {
    return new OntologyStore([]);
  }
  try {
    const raw = JSON.parse(readFileSync(ontologyPath, "utf8")) as unknown;
    const entities = (Array.isArray(raw)
      ? raw
      : ((raw as { entities?: OntologyEntity[] }).entities ?? [])) as OntologyEntity[];
    return new OntologyStore(entities);
  } catch {
    return new OntologyStore([]);
  }
}

export class ProductDevelopPipeline {
  private spans: SpanCollector;
  private hooks = new LifecycleHooks();
  private tools = new ToolRegistry();
  readonly mcpBridge: McpGroundingBridge;
  readonly memory: MemoryBackend | null;
  private readonly ontology: OntologyStore;
  private sessionSnap: MemorySnapshot | null = null;
  private sandboxReady: Promise<SandboxProvider>;

  constructor(private readonly opts: PipelineOptions) {
    const run = opts.store.getRun(opts.runId);
    if (!run) throw new Error(`Run not found: ${opts.runId}`);
    this.spans = new SpanCollector(
      opts.runId,
      join(opts.dataDir, "runs", opts.runId, "spans"),
    );
    registerFsTools(this.tools, run.workspace);
    this.ontology = loadOntologyStore(run.workspace);
    this.mcpBridge = new McpGroundingBridge(this.ontology);
    this.memory = createMemoryBackend(
      opts.dataDir,
      opts.providers.settings.memory,
    );
    this.tools.register({
      meta: {
        name: "mcp_ground",
        description: "Resolve and contextualize domain identifiers before use",
        risk: "read",
        requiresApproval: false,
      },
      inputSchema: z.object({ refs: z.array(z.string()).min(1) }),
      execute: async ({ refs }) => {
        const resolved = this.mcpBridge.resolve({ refs });
        const entityIds = resolved.resolved.map((e: OntologyEntity) => e.id);
        const contextualized =
          entityIds.length > 0
            ? this.mcpBridge.contextualize({ entityIds, maxTokens: 2000 })
            : { context: "", entities: [] };
        return { ...resolved, contextualized };
      },
    });
    if (this.memory) {
      this.tools.register({
        meta: {
          name: "memory_search",
          description:
            "Search Obsidian vault memory (decisions, learnings, episodes, procedures)",
          risk: "read",
          requiresApproval: false,
        },
        inputSchema: z.object({
          query: z.string().min(1),
          kind: z.enum(["semantic", "episodic", "procedural"]).optional(),
          limit: z.number().int().positive().default(8),
        }),
        execute: async ({ query, kind, limit }) =>
          this.memory!.search(query, { kind, limit }),
      });
      this.tools.register({
        meta: {
          name: "memory_write",
          description:
            "Persist a decision, learning, episode, or procedure to the vault",
          risk: "write",
          requiresApproval: false,
        },
        inputSchema: z.object({
          kind: z.enum(["semantic", "episodic", "procedural"]),
          title: z.string().min(1),
          content: z.string().min(1),
          tags: z.array(z.string()).default([]),
          entityId: z.string().optional(),
          links: z.array(z.string()).default([]),
        }),
        execute: async (input) => {
          await this.memory!.remember({
            ...input,
            runId: this.opts.runId,
          });
          if (input.kind === "semantic" && input.entityId) {
            this.ontology.upsert({
              id: input.entityId,
              type: "memory",
              label: input.title,
              aliases: input.tags,
              metadata: { content: input.content.slice(0, 500) },
            });
          }
          return { ok: true };
        },
      });
    }
    this.sandboxReady = createSandbox(
      opts.sandboxKind ??
        ((process.env.HARNESS_DEFAULT_SANDBOX as SandboxKind | undefined) ??
          "docker"),
      run.workspace,
    ).then((sandbox) => {
      registerExecTool(this.tools, sandbox);
      return sandbox;
    });
    installRalphLoop(this.hooks, {
      maxContinuations: 3,
      goal: run.brief,
    });
  }

  async tick(): Promise<{
    phase: PipelinePhase;
    status: string;
    message: string;
  }> {
    await this.sandboxReady;
    await this.ensureSessionMemory();
    const run = this.opts.store.getRun(this.opts.runId);
    if (!run) throw new Error("missing run");

    if (run.status === "completed" || run.status === "failed") {
      return { phase: run.phase, status: run.status, message: "terminal" };
    }

    try {
      switch (run.phase) {
        case "GENERATE_PRD":
          await this.generatePrd();
          break;
        case "AWAIT_PRD_APPROVAL":
          return this.handleHitl("prd");
        case "PARALLEL_TECH_DOCS":
          await this.parallelTechDocs();
          break;
        case "GENERATE_SPEC":
          await this.generateSpec();
          break;
        case "VALIDATE_SPEC":
          await this.validateSpec();
          break;
        case "PLAN_SPRINTS":
          await this.planSprints();
          break;
        case "AWAIT_SPRINT_APPROVAL":
          return this.handleHitl("sprint");
        case "EXECUTE_SPRINTS":
          await this.executeSprints();
          break;
        case "DONE":
        case "FAILED":
          return { phase: run.phase, status: run.status, message: "terminal" };
        default: {
          const _exhaustive: never = run.phase;
          throw new Error(`Unhandled phase: ${_exhaustive}`);
        }
      }
      const next = this.opts.store.getRun(this.opts.runId)!;
      this.syncCosts(next.id);
      return {
        phase: next.phase,
        status: next.status,
        message: `advanced to ${next.phase}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.opts.store.updateRun(this.opts.runId, {
        status: "failed",
        phase: "FAILED",
        error: message,
      });
      return { phase: "FAILED", status: "failed", message };
    }
  }

  async runToCompletion(maxTicks = 50): Promise<void> {
    for (let i = 0; i < maxTicks; i++) {
      const r = await this.tick();
      if (r.status === "completed" || r.status === "failed") return;
      if (r.status === "awaiting_approval" && !this.opts.autoApprove) return;
    }
    throw new Error("Pipeline exceeded max ticks");
  }

  private syncCosts(runId: string): void {
    const totals = this.opts.providers.ledger.totals();
    this.opts.store.updateRun(runId, {
      tokensUsed: totals.tokens,
      costUsd: totals.costUsd,
    });
  }

  private artifacts(): string {
    return artifactRoot(this.opts.dataDir, this.opts.runId);
  }

  private async ensureSessionMemory(): Promise<void> {
    if (!this.memory || this.sessionSnap) return;
    const run = this.opts.store.getRun(this.opts.runId)!;
    this.sessionSnap = await this.memory.hydrate(run.id, [
      run.brief,
      run.vertical,
      ...run.brief.split(/\s+/).filter((w) => w.length > 4).slice(0, 6),
    ]);
    await this.memory.remember({
      kind: "episodic",
      title: "Session start",
      content: `Pipeline ${run.pipeline} / vertical ${run.vertical}\nBrief: ${run.brief}`,
      tags: ["session", run.vertical],
      runId: run.id,
      links: ["Procedures/memory-policy"],
    });
  }

  private context(workerId = "main"): ContextManager {
    const ctx = new ContextManager({
      store: this.opts.store,
      runId: this.opts.runId,
      artifactDir: join(this.artifacts(), "context", workerId),
      memory: this.memory,
    });
    if (this.sessionSnap) ctx.seedSnapshot(this.sessionSnap);
    return ctx;
  }

  private async rememberPhase(
    title: string,
    content: string,
    tags: string[] = [],
    kind: "semantic" | "episodic" = "episodic",
  ): Promise<void> {
    if (!this.memory) return;
    await this.memory.remember({
      kind,
      title,
      content,
      tags,
      runId: this.opts.runId,
      links: [],
    });
  }

  private async generatePrd(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const vertical = getVertical(run.vertical);
    const phaseSpan = this.spans.start("phase", "GENERATE_PRD");
    const prd = await generateStructured({
      role: "prd_writer",
      system: `You are the PRD Writer. Output must match the schema exactly.\n${vertical.systemHints.prd}`,
      prompt: `User brief:\n${run.brief}\n\nVertical: ${vertical.title}\nDefault stack: ${JSON.stringify(vertical.defaultStack)}`,
      schema: PrdSchema,
      providers: this.opts.providers,
      spans: this.spans,
    });
    const path = join(this.artifacts(), "prd.json");
    writeJson(path, prd);
    this.opts.store.addArtifact(run.id, "prd", path);
    this.opts.store.addEpisode(run.id, `PRD generated: ${prd.title}`);
    await this.rememberPhase(
      `PRD: ${prd.title}`,
      `${prd.summary}\nGoals: ${prd.goals.join("; ")}`,
      ["prd", "decision"],
      "semantic",
    );
    this.spans.end(phaseSpan, "ok");

    this.opts.store.createApproval({
      runId: run.id,
      kind: "prd",
      title: `Approve PRD: ${prd.title}`,
      description: prd.summary,
      payloadPath: path,
    });
    this.opts.store.updateRun(run.id, {
      phase: "AWAIT_PRD_APPROVAL",
      status: "awaiting_approval",
    });
    if (this.opts.autoApprove) {
      const pending = this.opts.store.listPendingApprovals(run.id)[0];
      if (pending) this.opts.store.resolveApproval(pending.id, "approved", "auto");
    }
  }

  private handleHitl(kind: "prd" | "sprint"): {
    phase: PipelinePhase;
    status: string;
    message: string;
  } {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const pending = this.opts.store
      .listPendingApprovals(run.id)
      .filter((a) => a.kind === kind);
    if (pending.length === 0) {
      // approved — advance
      if (kind === "prd") {
        this.opts.store.updateRun(run.id, {
          phase: "PARALLEL_TECH_DOCS",
          status: "running",
        });
      } else {
        this.opts.store.updateRun(run.id, {
          phase: "EXECUTE_SPRINTS",
          status: "running",
        });
      }
      return {
        phase: kind === "prd" ? "PARALLEL_TECH_DOCS" : "EXECUTE_SPRINTS",
        status: "running",
        message: `${kind} approved`,
      };
    }
    if (this.opts.autoApprove) {
      for (const p of pending) {
        this.opts.store.resolveApproval(p.id, "approved", "auto");
      }
      return this.handleHitl(kind);
    }
    return {
      phase: run.phase,
      status: "awaiting_approval",
      message: `Waiting HITL: ${pending.map((p) => p.id).join(", ")}`,
    };
  }

  private async parallelTechDocs(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const prd = PrdSchema.parse(
      JSON.parse(readFileSync(join(this.artifacts(), "prd.json"), "utf8")),
    );
    const supervisor = new Supervisor(
      this.opts.providers,
      this.spans,
      this.hooks,
    );
    const topics = [
      { id: "db", role: "tech_docs_db", title: "Data model & persistence" },
      {
        id: "frontend",
        role: "tech_docs_frontend",
        title: "Frontend / UX surfaces",
      },
      {
        id: "backend",
        role: "tech_docs_backend",
        title: "Backend / domain logic",
      },
      {
        id: "security",
        role: "tech_docs_security",
        title: "Security & threat model",
      },
    ] as const;

    const results = await supervisor.runWorkersParallel(
      topics.map((t) => ({
        id: t.id,
        role: t.role,
        system:
          `You write technical documentation for one concern only: ${t.title}. ` +
          `Write a markdown doc via write_file to docs/tech/${t.id}.md. End with [[DONE]].`,
        prompt: `PRD JSON:\n${JSON.stringify(prd, null, 2)}`,
      })),
      {
        tools: this.tools,
        contextFactory: (id) => this.context(id),
        limits: { maxSteps: 8, tokenBudget: 80_000 },
      },
    );

    writeJson(
      join(this.artifacts(), "tech-docs-results.json"),
      results.map((r) => ({
        id: r.id,
        stopped: r.result.stoppedReason,
        error: r.result.error,
      })),
    );
    this.opts.store.updateRun(run.id, {
      phase: "GENERATE_SPEC",
      status: "running",
    });
  }

  private async generateSpec(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const vertical = getVertical(run.vertical);
    const prd = readFileSync(join(this.artifacts(), "prd.json"), "utf8");
    const phaseSpan = this.spans.start("phase", "GENERATE_SPEC");
    const spec = await generateStructured({
      role: "spec_writer",
      system: `You are the Spec Writer. Strict schema. ${vertical.systemHints.spec}`,
      prompt: `PRD:\n${prd}\n\nDefault stack: ${JSON.stringify(vertical.defaultStack)}\nConstraints: ${(vertical.setupConstraints ?? []).join("; ")}`,
      schema: SpecSchema,
      providers: this.opts.providers,
      spans: this.spans,
    });
    const extras = vertical.validateSpecExtras(spec);
    if (extras.length) {
      throw new Error(`Spec vertical validation failed: ${extras.join("; ")}`);
    }
    const path = join(this.artifacts(), "spec.json");
    writeJson(path, spec);
    this.opts.store.addArtifact(run.id, "spec", path);
    await this.rememberPhase(
      `Spec: ${spec.title}`,
      `${spec.architecture.overview}\nStack: ${spec.stack.language} ${spec.stack.framework ?? spec.stack.engine ?? ""}\nOffline: ${spec.architecture.offlineOnly}`,
      ["spec", "decision", run.vertical],
      "semantic",
    );
    this.spans.end(phaseSpan, "ok");
    this.opts.store.updateRun(run.id, {
      phase: "VALIDATE_SPEC",
      status: "running",
    });
  }

  private async validateSpec(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const rounds = this.opts.validatorRounds ?? 3;
    let specJson = readFileSync(join(this.artifacts(), "spec.json"), "utf8");
    const supervisor = new Supervisor(
      this.opts.providers,
      this.spans,
      this.hooks,
    );
    const findingSchema = z.object({
      blockingIssues: z.array(z.string()),
      suggestedFixes: z.array(z.string()),
      severity: z.enum(["ok", "warn", "block"]),
    });

    for (let round = 1; round <= rounds; round++) {
      const [a, b] = await Promise.all([
        generateStructured({
          role: "spec_validator_a",
          system:
            "Validator A: focus on correctness, data model integrity, and missing acceptance paths.",
          prompt: `Round ${round}. Spec:\n${specJson}`,
          schema: findingSchema,
          providers: this.opts.providers,
          spans: this.spans,
        }),
        generateStructured({
          role: "spec_validator_b",
          system:
            "Validator B: focus on security, boundaries, offline constraints, and over-scope.",
          prompt: `Round ${round}. Spec:\n${specJson}`,
          schema: findingSchema,
          providers: this.opts.providers,
          spans: this.spans,
        }),
      ]);

      writeJson(join(this.artifacts(), `validate-round-${round}.json`), {
        a,
        b,
      });

      if (a.severity === "ok" && b.severity === "ok") break;

      const merge = await supervisor.mergeValidatorFindings({
        findingsA: JSON.stringify(a),
        findingsB: JSON.stringify(b),
        currentSpecJson: specJson,
      });
      writeJson(join(this.artifacts(), `validate-merge-${round}.json`), merge);
      if (merge.patchedSpecJson) {
        const parsed = SpecSchema.safeParse(JSON.parse(merge.patchedSpecJson));
        if (parsed.success) {
          specJson = JSON.stringify(parsed.data, null, 2);
          writeFileSync(join(this.artifacts(), "spec.json"), specJson, "utf8");
        }
      }
    }

    // Final schema gate — invalid specs never reach execution
    SpecSchema.parse(JSON.parse(specJson));
    await this.rememberPhase(
      "Spec validated",
      `Dual-validator rounds completed (${rounds} max). Spec schema gate passed.`,
      ["validation", "spec"],
    );
    this.opts.store.updateRun(run.id, {
      phase: "PLAN_SPRINTS",
      status: "running",
    });
  }

  private async planSprints(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const spec = readFileSync(join(this.artifacts(), "spec.json"), "utf8");
    const plan = await generateStructured({
      role: "sprint_planner",
      system:
        "Plan executable sprints with exact task IDs (T-1..) and sprint IDs (S-1..). " +
        "Keep dependencies acyclic. Prefer 3-6 sprints.",
      prompt: `Spec:\n${spec}`,
      schema: SprintPlanSchema,
      providers: this.opts.providers,
      spans: this.spans,
    });
    const path = join(this.artifacts(), "sprints.json");
    writeJson(path, plan);
    this.opts.store.addArtifact(run.id, "sprints", path);
    await this.rememberPhase(
      `Sprint plan (${plan.sprints.length})`,
      plan.sprints.map((s) => `${s.id}: ${s.title} — ${s.goal}`).join("\n"),
      ["sprints"],
    );
    this.opts.store.createApproval({
      runId: run.id,
      kind: "sprint",
      title: `Approve sprint plan (${plan.sprints.length} sprints)`,
      description: plan.sprints.map((s) => s.title).join(", "),
      payloadPath: path,
    });
    this.opts.store.updateRun(run.id, {
      phase: "AWAIT_SPRINT_APPROVAL",
      status: "awaiting_approval",
    });
    if (this.opts.autoApprove) {
      const pending = this.opts.store.listPendingApprovals(run.id)[0];
      if (pending) this.opts.store.resolveApproval(pending.id, "approved", "auto");
    }
  }

  private async executeSprints(): Promise<void> {
    const run = this.opts.store.getRun(this.opts.runId)!;
    const vertical = getVertical(run.vertical);
    const plan = SprintPlanSchema.parse(
      JSON.parse(readFileSync(join(this.artifacts(), "sprints.json"), "utf8")),
    );
    const spec = readFileSync(join(this.artifacts(), "spec.json"), "utf8");

    for (const sprint of plan.sprints) {
      const span = this.spans.start("phase", `EXECUTE_${sprint.id}`);
      const result = await runAgentLoop({
        role: "developer",
        system:
          `${vertical.systemHints.exec}\nYou implement one sprint at a time using tools. ` +
          `When sprint acceptance criteria are met, respond with [[DONE]].`,
        prompt:
          `Sprint ${sprint.id}: ${sprint.title}\nGoal: ${sprint.goal}\n` +
          `Tasks:\n${JSON.stringify(sprint.tasks, null, 2)}\n\nSpec:\n${spec}`,
        providers: this.opts.providers,
        tools: this.tools,
        context: this.context(`dev-${sprint.id}`),
        spans: this.spans,
        hooks: this.hooks,
        limits: { maxSteps: 30, tokenBudget: 300_000 },
      });

      // Dev validator pass
      const validation = await runAgentLoop({
        role: "dev_validator",
        system:
          "Validate the sprint implementation against acceptance criteria. " +
          "If issues remain, write a fix list to docs/validation/" +
          sprint.id +
          ".md and end with [[DONE]].",
        prompt: `Sprint:\n${JSON.stringify(sprint)}\nDeveloper summary:\n${result.text}`,
        providers: this.opts.providers,
        tools: this.tools,
        context: this.context(`val-${sprint.id}`),
        spans: this.spans,
        hooks: this.hooks,
        limits: { maxSteps: 10, tokenBudget: 80_000 },
      });

      writeJson(join(this.artifacts(), `exec-${sprint.id}.json`), {
        developer: result,
        validator: {
          stopped: validation.stoppedReason,
          text: validation.text,
        },
      });
      this.spans.end(span, result.error ? "error" : "ok");
      if (result.error) {
        await this.rememberPhase(
          `Learning: sprint ${sprint.id} failed`,
          result.error,
          ["learning", "error", sprint.id],
          "semantic",
        );
        throw new Error(result.error);
      }
      await this.rememberPhase(
        `Sprint ${sprint.id} done`,
        `${sprint.title}\n${result.text.slice(0, 600)}`,
        ["sprint", sprint.id],
      );
    }

    await this.rememberPhase(
      "Run completed",
      `Vertical ${run.vertical} finished successfully.`,
      ["done", run.vertical],
    );
    this.opts.store.updateRun(run.id, {
      phase: "DONE",
      status: "completed",
    });
  }
}

export type { Prd, Spec, SprintPlan };
