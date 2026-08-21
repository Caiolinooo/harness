import { z } from "zod";
import type { ToolMeta } from "@harness/contracts";
import { ToolMetaSchema } from "@harness/contracts";
import { PermissionPolicy } from "../permissions/policy.js";

export type ToolInvokeFailure = {
  ok: false;
  error: string;
  schemaPass: boolean;
  requiresHitl?: true;
};

export type ToolInvokeResult =
  | { ok: true; result: unknown }
  | ToolInvokeFailure;

export interface ToolRegistryOptions {
  onHitl?: (meta: ToolMeta) => void;
}

export interface RegisteredTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  meta: ToolMeta;
  inputSchema: TSchema;
  execute: (input: z.infer<TSchema>) => Promise<unknown> | unknown;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private readonly policy: PermissionPolicy;
  private readonly onHitl?: (meta: ToolMeta) => void;

  constructor(opts?: ToolRegistryOptions) {
    this.policy = new PermissionPolicy();
    this.onHitl = opts?.onHitl;
  }

  register<TSchema extends z.ZodTypeAny>(tool: RegisteredTool<TSchema>): void {
    const meta = ToolMetaSchema.parse(tool.meta);
    if (this.tools.has(meta.name)) {
      throw new Error(`Tool already registered: ${meta.name}`);
    }
    this.tools.set(meta.name, tool as unknown as RegisteredTool);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): ToolMeta[] {
    return [...this.tools.values()].map((t) => t.meta);
  }

  /** Validate + execute; schema failures become capturable errors (not hallucinations). */
  async invoke(name: string, rawArgs: unknown): Promise<ToolInvokeResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `Unknown tool: ${name}`, schemaPass: false };
    }
    const decision = this.policy.decide(tool.meta);
    if (!decision.allow) {
      if (decision.requiresHitl) {
        this.onHitl?.(tool.meta);
        return {
          ok: false,
          error: decision.reason,
          schemaPass: true,
          requiresHitl: true,
        };
      }
      return { ok: false, error: decision.reason, schemaPass: true };
    }
    const parsed = tool.inputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Schema validation failed for ${name}: ${parsed.error.message}`,
        schemaPass: false,
      };
    }
    try {
      const result = await tool.execute(parsed.data);
      return { ok: true, result };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        schemaPass: true,
      };
    }
  }

  toAiSdkTools(): Record<
    string,
    {
      description: string;
      parameters: z.ZodTypeAny;
      execute: (args: unknown) => Promise<unknown>;
    }
  > {
    const out: Record<
      string,
      {
        description: string;
        parameters: z.ZodTypeAny;
        execute: (args: unknown) => Promise<unknown>;
      }
    > = {};
    for (const [name, tool] of this.tools) {
      out[name] = {
        description: tool.meta.description,
        parameters: tool.inputSchema,
        execute: async (args: unknown) => {
          const res = await this.invoke(name, args);
          if (!res.ok) throw new Error(res.error);
          return res.result;
        },
      };
    }
    return out;
  }
}
