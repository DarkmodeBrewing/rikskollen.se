import z from 'zod';

export const AttributeSchema = z
  .object({
    uppgift: z
      .array(
        z.object({
          kod: z.string(),
          uppgift: z.array(z.unknown()),
          typ: z.string(),
          intressent_id: z.string(),
        }),
      )
      .optional(),
  })
  .nullish();

export const AttributesDTO = z
  .object({
    personId: z.string().nonempty(),
    code: z.string(),
    kind: z.string(),
    value: z.array(z.unknown()),
  })
  .strict();

export type AttributesDTO = z.infer<typeof AttributesDTO>;
