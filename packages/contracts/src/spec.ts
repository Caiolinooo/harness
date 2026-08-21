import { z } from "zod";

export const SpecComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  responsibility: z.string().min(1),
  interfaces: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
});

export const SpecDataModelSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().default(true),
        }),
      ),
    }),
  ),
  persistence: z.enum(["sqlite", "postgres", "filesystem", "unreal-save", "none"]),
});

export const SpecSchema = z.object({
  version: z.literal("1.0"),
  title: z.string().min(1),
  prdRef: z.string().min(1),
  architecture: z.object({
    style: z.string(),
    overview: z.string(),
    offlineOnly: z.boolean().default(false),
  }),
  stack: z.object({
    language: z.string(),
    framework: z.string().optional(),
    engine: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
  }),
  components: z.array(SpecComponentSchema).min(1),
  dataModel: SpecDataModelSchema,
  boundaries: z.array(z.string()).default([]),
  security: z.array(z.string()).default([]),
  testStrategy: z.array(z.string()).default([]),
  glossary: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .default([]),
});

export type Spec = z.infer<typeof SpecSchema>;
