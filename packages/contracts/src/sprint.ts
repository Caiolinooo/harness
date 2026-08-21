import { z } from "zod";

export const SprintTaskSchema = z.object({
  id: z.string().regex(/^T-\d+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  estimatedFiles: z.array(z.string()).default([]),
});

export const SprintSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().regex(/^S-\d+$/),
  title: z.string().min(1),
  goal: z.string().min(1),
  tasks: z.array(SprintTaskSchema).min(1),
  verifyCommands: z.array(z.string()).default([]),
  parallelSafe: z.boolean().default(false),
});

export const SprintPlanSchema = z.object({
  version: z.literal("1.0"),
  specRef: z.string(),
  sprints: z.array(SprintSchema).min(1),
});

export type Sprint = z.infer<typeof SprintSchema>;
export type SprintPlan = z.infer<typeof SprintPlanSchema>;
