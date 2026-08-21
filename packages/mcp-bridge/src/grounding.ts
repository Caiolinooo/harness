import { z } from "zod";
import { OntologyStore, type OntologyEntity } from "./ontology.js";

export const ResolveRequestSchema = z.object({
  refs: z.array(z.string()).min(1),
});

export const ContextualizeRequestSchema = z.object({
  entityIds: z.array(z.string()).min(1),
  maxTokens: z.number().int().positive().default(2000),
});

export const AnnotateRequestSchema = z.object({
  text: z.string(),
  entityIds: z.array(z.string()).default([]),
});

export interface ResolveResult {
  resolved: OntologyEntity[];
  unresolved: string[];
}

export interface ContextualizeResult {
  context: string;
  entities: OntologyEntity[];
}

export interface AnnotateResult {
  annotated: string;
  citations: Array<{ id: string; label: string }>;
}

/**
 * MCP-style grounding contract demanded by The Last Harness PDF.
 */
export class McpGroundingBridge {
  constructor(private readonly ontology: OntologyStore) {}

  resolve(input: z.infer<typeof ResolveRequestSchema>): ResolveResult {
    const { refs } = ResolveRequestSchema.parse(input);
    const resolved: OntologyEntity[] = [];
    const unresolved: string[] = [];
    for (const ref of refs) {
      const entity = this.ontology.resolve(ref);
      if (entity) resolved.push(entity);
      else unresolved.push(ref);
    }
    return { resolved, unresolved };
  }

  contextualize(
    input: z.infer<typeof ContextualizeRequestSchema>,
  ): ContextualizeResult {
    const { entityIds, maxTokens } = ContextualizeRequestSchema.parse(input);
    const entities: OntologyEntity[] = [];
    for (const id of entityIds) {
      const e = this.ontology.resolve(id);
      if (!e) {
        throw new Error(`Cannot contextualize unresolved id: ${id}`);
      }
      entities.push(e);
    }
    let context = entities
      .map(
        (e) =>
          `- [${e.type}] ${e.id}: ${e.label}` +
          (Object.keys(e.metadata).length
            ? ` meta=${JSON.stringify(e.metadata)}`
            : ""),
      )
      .join("\n");
    if (context.length > maxTokens * 4) {
      context = context.slice(0, maxTokens * 4) + "\n…[truncated]";
    }
    return { context, entities };
  }

  annotate(input: z.infer<typeof AnnotateRequestSchema>): AnnotateResult {
    const { text, entityIds } = AnnotateRequestSchema.parse(input);
    const citations: Array<{ id: string; label: string }> = [];
    let annotated = text;
    for (const id of entityIds) {
      const e = this.ontology.resolve(id);
      if (!e) {
        throw new Error(`Cannot annotate with unresolved id: ${id}`);
      }
      citations.push({ id: e.id, label: e.label });
      annotated = annotated.replaceAll(e.label, `${e.label} ⟦${e.id}⟧`);
    }
    return { annotated, citations };
  }

  /** Reject tool args that contain unresolved domain identifiers. */
  assertResolved(refs: string[]): void {
    const { unresolved } = this.resolve({ refs });
    if (unresolved.length > 0) {
      throw new Error(
        `Unresolved domain identifiers blocked: ${unresolved.join(", ")}`,
      );
    }
  }
}
