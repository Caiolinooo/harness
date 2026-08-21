import type { ProviderRegistry } from "@harness/providers";
import type { SpanCollector } from "@harness/observability";
import { generateStructured } from "../loop/structured.js";
import { runAgentLoop, type AgentLoopResult } from "../loop/agent-loop.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ContextManager } from "../context/manager.js";
import type { LifecycleHooks } from "../hooks/lifecycle.js";
import { z } from "zod";

export interface WorkerSpec {
  id: string;
  role: string;
  system: string;
  prompt: string;
  tools?: ToolRegistry;
}

export interface WorkerResult {
  id: string;
  role: string;
  result: AgentLoopResult;
}

/**
 * Supervisor-Worker: fan-out workers with isolated prompts; orchestrator merges.
 */
export class Supervisor {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly spans: SpanCollector,
    private readonly hooks: LifecycleHooks,
  ) {}

  async runWorkersParallel(
    workers: WorkerSpec[],
    shared: {
      tools: ToolRegistry;
      contextFactory: (workerId: string) => ContextManager;
      limits?: Parameters<typeof runAgentLoop>[0]["limits"];
    },
  ): Promise<WorkerResult[]> {
    const parent = this.spans.start("worker", "fanout", {
      count: workers.length,
    });
    try {
      const results = await Promise.all(
        workers.map(async (w) => {
          const span = this.spans.start("worker", w.id, { role: w.role }, parent.id);
          const result = await runAgentLoop({
            role: w.role,
            system: w.system,
            prompt: w.prompt,
            providers: this.providers,
            tools: w.tools ?? shared.tools,
            context: shared.contextFactory(w.id),
            spans: this.spans,
            hooks: this.hooks,
            limits: shared.limits,
          });
          this.spans.end(span, result.error ? "error" : "ok", {
            stoppedReason: result.stoppedReason,
          });
          return { id: w.id, role: w.role, result };
        }),
      );
      this.spans.end(parent, "ok");
      return results;
    } catch (err) {
      this.spans.end(
        parent,
        "error",
        {},
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  /**
   * Orchestrator filters over-eager validator fixes (Lion Code pattern).
   */
  async mergeValidatorFindings(opts: {
    findingsA: string;
    findingsB: string;
    currentSpecJson: string;
  }): Promise<{
    acceptedFixes: string[];
    rejectedFixes: string[];
    rationale: string;
    patchedSpecJson?: string;
  }> {
    const schema = z.object({
      acceptedFixes: z.array(z.string()),
      rejectedFixes: z.array(z.string()),
      rationale: z.string(),
      patchedSpecJson: z.string().optional(),
    });
    return generateStructured({
      role: "orchestrator",
      system:
        "You are the orchestrator. Two validators may over-eagerly request fixes. " +
        "Accept only fixes that correct real correctness/security/spec-contract issues. " +
        "Reject style nits and speculative scope expansion.",
      prompt: `Current spec JSON:\n${opts.currentSpecJson}\n\nValidator A:\n${opts.findingsA}\n\nValidator B:\n${opts.findingsB}`,
      schema,
      providers: this.providers,
      spans: this.spans,
    });
  }
}
