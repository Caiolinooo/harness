import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Approval, PipelinePhase, RunRecord } from "@harness/contracts";

interface StoreShape {
  runs: RunRecord[];
  approvals: Approval[];
  artifacts: Array<{ id: string; runId: string; kind: string; path: string; createdAt: string }>;
  episodic: Array<{ id: string; runId: string; content: string; createdAt: string }>;
}

const EMPTY: StoreShape = {
  runs: [],
  approvals: [],
  artifacts: [],
  episodic: [],
};

/**
 * Local-first JSON store (portable, no native deps, works in Next.js without
 * better-sqlite3 native bindings). Data file: <dataDir>/harness.json
 */
export class HarnessStore {
  private readonly file: string;
  private state: StoreShape;

  constructor(dataDir: string) {
    const root = resolve(dataDir);
    mkdirSync(root, { recursive: true });
    this.file = join(root, "harness.json");
    this.state = this.load();
  }

  private load(): StoreShape {
    try {
      if (!existsSync(this.file)) return structuredClone(EMPTY);
      const raw = JSON.parse(readFileSync(this.file, "utf8"));
      return {
        runs: Array.isArray(raw.runs) ? raw.runs : [],
        approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
        artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : [],
        episodic: Array.isArray(raw.episodic) ? raw.episodic : [],
      };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.state, null, 2), "utf8");
  }

  createRun(input: {
    pipeline: string;
    vertical: string;
    workspace: string;
    brief: string;
    tokenBudget?: number;
  }): RunRecord {
    const now = new Date().toISOString();
    const run: RunRecord = {
      id: randomUUID(),
      pipeline: input.pipeline,
      vertical: input.vertical,
      workspace: input.workspace,
      phase: "GENERATE_PRD",
      status: "queued",
      brief: input.brief,
      createdAt: now,
      updatedAt: now,
      tokenBudget: input.tokenBudget ?? 5_000_000,
      tokensUsed: 0,
      costUsd: 0,
    };
    this.state.runs.unshift(run);
    this.persist();
    return run;
  }

  getRun(id: string): RunRecord | null {
    return this.state.runs.find((r) => r.id === id) ?? null;
  }

  listRuns(limit = 50): RunRecord[] {
    return [...this.state.runs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  updateRun(
    id: string,
    patch: Partial<{
      phase: PipelinePhase;
      status: RunRecord["status"];
      error: string;
      tokensUsed: number;
      costUsd: number;
    }>,
  ): RunRecord {
    const idx = this.state.runs.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Run not found: ${id}`);
    const current = this.state.runs[idx]!;
    const next: RunRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.state.runs[idx] = next;
    this.persist();
    return next;
  }

  createApproval(input: Omit<Approval, "id" | "createdAt" | "status"> & {
    status?: Approval["status"];
  }): Approval {
    const approval: Approval = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: input.status ?? "pending",
      runId: input.runId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      payloadPath: input.payloadPath,
    };
    this.state.approvals.push(approval);
    this.persist();
    return approval;
  }

  listPendingApprovals(runId?: string): Approval[] {
    return this.state.approvals.filter(
      (a) => a.status === "pending" && (!runId || a.runId === runId),
    );
  }

  resolveApproval(
    id: string,
    status: "approved" | "rejected",
    note?: string,
  ): Approval {
    const idx = this.state.approvals.findIndex((a) => a.id === id);
    if (idx < 0) throw new Error(`Approval not found: ${id}`);
    const current = this.state.approvals[idx]!;
    const next: Approval = {
      ...current,
      status,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note,
    };
    this.state.approvals[idx] = next;
    this.persist();
    return next;
  }

  addArtifact(runId: string, kind: string, path: string): void {
    this.state.artifacts.push({
      id: randomUUID(),
      runId,
      kind,
      path,
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }

  listArtifacts(runId: string): Array<{ kind: string; path: string }> {
    return this.state.artifacts
      .filter((a) => a.runId === runId)
      .map((a) => ({ kind: a.kind, path: a.path }));
  }

  addEpisode(runId: string, content: string): void {
    this.state.episodic.push({
      id: randomUUID(),
      runId,
      content,
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }

  listEpisodes(runId: string, limit = 20): string[] {
    return this.state.episodic
      .filter((e) => e.runId === runId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((e) => e.content)
      .reverse();
  }

  /** No-op — JSON store has no persistent handle. Kept for API compatibility. */
  close(): void {
    /* no-op */
  }
}
