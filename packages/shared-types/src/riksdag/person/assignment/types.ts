import z from 'zod';

// Values in the Riksdag JSON can be strings, empty strings or numbers.
export const AssignmentSchema = z
  .object({
    uppdrag: z
      .array(
        z.object({
          organ_kod: z.string(),
          roll_kod: z.string(),
          ordningsnummer: z.union([z.string(), z.number()]),
          status: z.string(),
          typ: z.string(),
          from: z.string().nullish(),
          tom: z.string().nullish(),
          uppgift: z.array(z.unknown()).optional(),
          intressent_id: z.string(),
        }),
      )
      .optional(),
  })
  .nullish();

export const AssignmentDTO = z
  .object({
    personId: z.string().nonempty(),
    organCode: z.string(),
    roleCode: z.string(),
    kind: z.string(),
    status: z.string().nullable(),
    from: z.string().nullable(),
    to: z.string().nullable(),
    value: z.string().nullable(), // normalized from uppgift[0]
    order: z.number(),
  })
  .strict();

export type AssignmentDTO = z.infer<typeof AssignmentDTO>;
