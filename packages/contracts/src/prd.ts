import { z } from "zod";

export const PrdScopeSchema = z.object({
  inScope: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const PrdRequirementSchema = z.object({
  id: z.string().regex(/^REQ-\d+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["must", "should", "could"]),
  acceptanceCriteria: z.array(z.string()).min(1),
});

export const PrdSchema = z.object({
  version: z.literal("1.0"),
  title: z.string().min(1),
  summary: z.string().min(1),
  persona: z.string().min(1),
  goals: z.array(z.string()).min(1),
  nonGoals: z.array(z.string()).default([]),
  scope: PrdScopeSchema,
  requirements: z.array(PrdRequirementSchema).min(1),
  constraints: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
});

export type Prd = z.infer<typeof PrdSchema>;
