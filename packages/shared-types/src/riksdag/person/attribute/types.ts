import z from 'zod';

// External
export const AttributeSchema = z
  .object({
    uppgift: z
      .array(
        z.object({
          kod: z.string(),
          uppgift: z.array(z.string()),
          typ: z.string(),
          intressent_id: z.string(),
          hangar_id: z.string(),
        }),
      )
      .optional(),
  })
  .optional();

// Internal
export const AttributesDTO = z
  .object({
    personId: z.string().nonempty(),
    code: z.string(),
    kind: z.string(),
    value: z.boolean(), // normalized from uppgift[0]
  })
  .strict();

export type AttributesDTO = z.infer<typeof AttributesDTO>;
