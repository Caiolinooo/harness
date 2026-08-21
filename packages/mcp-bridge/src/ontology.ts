import { z } from "zod";

/**
 * Domain ontology for MCP grounding:
 * resolve → contextualize → annotate
 * Unresolved identifiers never reach tools/DB.
 */
export const OntologyEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  aliases: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type OntologyEntity = z.infer<typeof OntologyEntitySchema>;

export class OntologyStore {
  private byId = new Map<string, OntologyEntity>();
  private byAlias = new Map<string, string>();

  constructor(entities: OntologyEntity[] = []) {
    for (const e of entities) this.upsert(e);
  }

  upsert(entity: OntologyEntity): void {
    const parsed = OntologyEntitySchema.parse(entity);
    this.byId.set(parsed.id, parsed);
    this.byAlias.set(parsed.id.toLowerCase(), parsed.id);
    this.byAlias.set(parsed.label.toLowerCase(), parsed.id);
    for (const a of parsed.aliases) {
      this.byAlias.set(a.toLowerCase(), parsed.id);
    }
  }

  resolve(ref: string): OntologyEntity | null {
    const id = this.byAlias.get(ref.toLowerCase()) ?? ref;
    return this.byId.get(id) ?? null;
  }

  list(): OntologyEntity[] {
    return [...this.byId.values()];
  }
}
