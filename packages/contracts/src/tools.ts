import { z } from "zod";

/** Every tool must declare a Zod schema — harness rejects untyped tools. */
export const ToolMetaSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1),
  risk: z.enum(["read", "write", "exec", "network", "privilege"]),
  requiresApproval: z.boolean().default(false),
});

export type ToolMeta = z.infer<typeof ToolMetaSchema>;

export const ProviderRoleConfigSchema = z.object({
  provider: z.enum(["openrouter", "openai", "anthropic", "moonshot"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  reasoning: z.enum(["none", "low", "medium", "high", "extra-high"]).optional(),
});

export const ProvidersFileSchema = z.object({
  defaults: z
    .object({
      temperature: z.number().optional(),
      maxTokens: z.number().int().optional(),
      timeoutMs: z.number().int().optional(),
    })
    .default({}),
  pricing: z
    .record(
      z.string(),
      z.object({
        input: z.number(),
        output: z.number(),
      }),
    )
    .default({}),
  roles: z.record(z.string(), ProviderRoleConfigSchema),
});

export type ProvidersFile = z.infer<typeof ProvidersFileSchema>;
export type ProviderRoleConfig = z.infer<typeof ProviderRoleConfigSchema>;
