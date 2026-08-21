import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type SpanKind =
  | "llm"
  | "tool"
  | "phase"
  | "worker"
  | "hitl"
  | "verify"
  | "system";

export interface SpanRecord {
  id: string;
  runId: string;
  parentId?: string;
  kind: SpanKind;
  name: string;
  role?: string;
  status: "ok" | "error" | "pending";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  attributes: Record<string, unknown>;
  error?: string;
}

export interface EvalMetrics {
  toolCalls: number;
  toolSchemaPasses: number;
  toolSchemaFails: number;
  llmCalls: number;
  adherenceFlags: number;
  totalDurationMs: number;
}

export class SpanCollector {
  private spans: SpanRecord[] = [];
  private metrics: EvalMetrics = {
    toolCalls: 0,
    toolSchemaPasses: 0,
    toolSchemaFails: 0,
    llmCalls: 0,
    adherenceFlags: 0,
    totalDurationMs: 0,
  };

  constructor(
    readonly runId: string,
    private readonly persistDir?: string,
  ) {
    if (persistDir) {
      mkdirSync(persistDir, { recursive: true });
    }
  }

  start(
    kind: SpanKind,
    name: string,
    attributes: Record<string, unknown> = {},
    parentId?: string,
  ): SpanRecord {
    const span: SpanRecord = {
      id: randomUUID(),
      runId: this.runId,
      parentId,
      kind,
      name,
      role: typeof attributes.role === "string" ? attributes.role : undefined,
      status: "pending",
      startedAt: new Date().toISOString(),
      attributes,
    };
    this.spans.push(span);
    return span;
  }

  end(
    span: SpanRecord,
    status: "ok" | "error" = "ok",
    extra: Record<string, unknown> = {},
    error?: string,
  ): SpanRecord {
    span.status = status;
    span.endedAt = new Date().toISOString();
    span.durationMs =
      new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime();
    span.attributes = { ...span.attributes, ...extra };
    if (error) span.error = error;
    this.metrics.totalDurationMs += span.durationMs ?? 0;

    if (span.kind === "llm") this.metrics.llmCalls += 1;
    if (span.kind === "tool") {
      this.metrics.toolCalls += 1;
      if (extra.schemaPass === true) this.metrics.toolSchemaPasses += 1;
      if (extra.schemaPass === false) this.metrics.toolSchemaFails += 1;
    }
    if (extra.adherenceViolation === true) this.metrics.adherenceFlags += 1;

    this.persist(span);
    return span;
  }

  private persist(span: SpanRecord): void {
    if (!this.persistDir) return;
    const file = join(this.persistDir, "spans.jsonl");
    if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(span)}\n`, "utf8");
  }

  list(): SpanRecord[] {
    return [...this.spans];
  }

  getMetrics(): EvalMetrics {
    return { ...this.metrics };
  }

  toolSelectionAccuracy(): number {
    if (this.metrics.toolCalls === 0) return 1;
    return this.metrics.toolSchemaPasses / this.metrics.toolCalls;
  }
}
