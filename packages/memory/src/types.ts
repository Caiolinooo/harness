import { z } from "zod";

export const MemoryKindSchema = z.enum([
  "semantic",
  "episodic",
  "procedural",
]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemoryEventSchema = z.object({
  kind: MemoryKindSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  runId: z.string().optional(),
  entityId: z.string().optional(),
  links: z.array(z.string()).default([]),
});
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

export interface MemoryHit {
  path: string;
  kind: MemoryKind;
  title: string;
  excerpt: string;
  score: number;
  tags: string[];
}

export interface MemorySnapshot {
  semantic: string[];
  episodic: string[];
  procedural: string[];
  notePaths: string[];
}

export interface MemoryBackend {
  readonly root: string;
  hydrate(runId: string, queryHints: string[]): Promise<MemorySnapshot>;
  remember(event: MemoryEvent): Promise<void>;
  search(
    query: string,
    opts?: { kind?: MemoryKind; limit?: number },
  ): Promise<MemoryHit[]>;
  listRecent(limit?: number): Promise<MemoryHit[]>;
}

export const MemorySettingsSchema = z.object({
  kind: z.enum(["none", "obsidian"]).default("obsidian"),
  vaultPath: z.string().default(""),
  projectId: z.string().default("default"),
  hydrateLimit: z.number().int().positive().default(20),
});
export type MemorySettings = z.infer<typeof MemorySettingsSchema>;
