import { generateObject } from "ai";
import type { z } from "zod";
import type { ProviderRegistry } from "@harness/providers";
import {
  demoMerge,
  demoPrd,
  demoSpec,
  demoSprintPlan,
  demoValidatorFindings,
} from "@harness/providers";
import type { SpanCollector } from "@harness/observability";

function buildDemoObject(
  role: string,
  system: string,
  prompt: string,
): unknown {
  if (role === "prd_writer") {
    const briefMatch = prompt.match(/User brief:\n([\s\S]*?)\n\nVertical:/);
    return demoPrd(briefMatch?.[1]?.trim() || prompt.slice(0, 200));
  }
  if (role === "spec_writer") {
    const text = `${system}\n${prompt}`;
    return demoSpec("Demo Product", /unreal/i.test(text) ? "unreal-cpp" : "coding");
  }
  if (role === "sprint_planner") {
    return demoSprintPlan();
  }
  if (role.startsWith("spec_validator")) {
    return demoValidatorFindings("ok");
  }
  if (role === "orchestrator") {
    return demoMerge();
  }
  // Generic fallback object
  return {
    ok: true,
    role,
    note: "demo-mode placeholder",
  };
}

export async function generateStructured<TSchema extends z.ZodTypeAny>(opts: {
  role: string;
  system: string;
  prompt: string;
  schema: TSchema;
  providers: ProviderRegistry;
  spans: SpanCollector;
}): Promise<z.infer<TSchema>> {
  const handle = opts.providers.get(opts.role);
  const span = opts.spans.start("llm", `structured:${opts.role}`, {
    role: opts.role,
    model: handle.modelId,
    demo: handle.demo,
  });
  try {
    if (handle.demo) {
      const raw = buildDemoObject(opts.role, opts.system, opts.prompt);
      const object = opts.schema.parse(raw);
      const usage = {
        promptTokens: 128,
        completionTokens: 256,
        totalTokens: 384,
      };
      opts.providers.ledger.record(opts.role, handle.config, usage);
      opts.spans.end(span, "ok", { usage, demo: true });
      return object;
    }

    const result = await generateObject({
      model: handle.model,
      system: opts.system,
      prompt: opts.prompt,
      schema: opts.schema,
      temperature: handle.config.temperature ?? 0.2,
    });
    const usage = {
      promptTokens: result.usage.promptTokens ?? 0,
      completionTokens: result.usage.completionTokens ?? 0,
      totalTokens:
        (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0),
    };
    opts.providers.ledger.record(opts.role, handle.config, usage);
    opts.spans.end(span, "ok", { usage });
    return result.object;
  } catch (err) {
    opts.spans.end(
      span,
      "error",
      {},
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}
