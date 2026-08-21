import { z } from "zod";

export const PipelinePhaseSchema = z.enum([
  "GENERATE_PRD",
  "AWAIT_PRD_APPROVAL",
  "PARALLEL_TECH_DOCS",
  "GENERATE_SPEC",
  "VALIDATE_SPEC",
  "PLAN_SPRINTS",
  "AWAIT_SPRINT_APPROVAL",
  "EXECUTE_SPRINTS",
  "DONE",
  "FAILED",
]);

export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>;

export const ApprovalKindSchema = z.enum([
  "prd",
  "sprint",
  "purchase",
  "micro_decision",
  "playtest",
  "setup",
  "policy",
]);

export const ApprovalSchema = z.object({
  id: z.string(),
  runId: z.string(),
  kind: ApprovalKindSchema,
  title: z.string(),
  description: z.string(),
  payloadPath: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolutionNote: z.string().optional(),
});

export type Approval = z.infer<typeof ApprovalSchema>;

export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const RunRecordSchema = z.object({
  id: z.string(),
  pipeline: z.string(),
  vertical: z.string(),
  workspace: z.string(),
  phase: PipelinePhaseSchema,
  status: RunStatusSchema,
  brief: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
  tokenBudget: z.number().int().positive().default(5_000_000),
  tokensUsed: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;
