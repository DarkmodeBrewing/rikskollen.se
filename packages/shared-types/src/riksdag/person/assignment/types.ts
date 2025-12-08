import z from 'zod';

// Internal
export const AssignmentSchema = z
  .object({
    uppdrag: z
      .array(
        z.object({
          organ_kod: z.string(),
          roll_kod: z.string(),
          ordningsnummer: z.number(),
          status: z.string(),
          typ: z.string(),
          from: z.date().optional(),
          tom: z.date().optional(),
          uppgift: z.array(z.string()).optional(),
          intressent_id: z.string(),
          hangar_id: z.string(),
          sortering: z.number(),
          organ_sortering: z.number(),
          uppdrag_rollsortering: z.number(),
          uppdrag_statussortering: z.number(),
        }),
      )
      .optional(),
  })
  .optional();

//External
export const AssingmentDTO = z
  .object({
    personId: z.string().nonempty(),
    organCode: z.string(),
    roleCode: z.string(),
    kind: z.string(),
    status: z.string().nullable(),
    from: z.date().nullable(),
    to: z.date().nullable,
    value: z.string().nullable(), // normalized from uppgift[0]
    order: z.number(),
  })
  .strict();

export type AssingmentDTO = z.infer<typeof AssingmentDTO>;
