import { z } from 'zod';

// Example external shape (keep permissive where you're unsure)
export const PoliticianPersonalSchema = z
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

export const PoliticianAssignmentSchema = z
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

export const PoliticianSchema = z
  .object({
    intressent_id: z.string().nonempty(), //Primary key
    sourceid: z.uuid(),
    fodd_ar: z.number(),
    kon: z.string(),
    efternamn: z.string(),
    tilltalsnamn: z.string(),
    parti: z.string(),
    valkrets: z.string(),
    status: z.string(),
    person_url_xml: z.url().optional().default(''),
    bild_url_80: z.url().optional().default(''),
    bild_url_192: z.url().optional().default(''),
    bild_url_max: z.url().optional().default(''),
    personuppdrag: PoliticianAssignmentSchema,
    personuppgift: PoliticianPersonalSchema,
  })
  .loose(); // ignore the many extra keys

export const PoliticianResponseSchema = z
  .object({
    personlista: z.object({
      person: z.array(PoliticianSchema),
    }),
  })
  .loose();

// Your **internal** model – only what you need, typed how you want it
export const PoliticianDTO = z.object({
  intressent_id: z.string().nonempty(),
  sourceid: z.uuid(),
  parti: z.string(),
  valkrets: z.string(),
  tilltalsnamn: z.string(),
  efternamn: z.string(),
  fodd_ar: z.string().nullable(), // normalized to Date|null
  status: z.string(),
  person_url_xml: z.url().nullable(),
  bild_url_80: z.url().optional().nullable(),
  bild_url_192: z.url().optional().nullable(),
  bild_url_max: z.url().optional().nullable(),
  ingested_at: z.date(),
  last_see_at: z.date(),
});
export type PoliticianDTO = z.infer<typeof PoliticianDTO>;
