import z from 'zod';
import { AssignmentSchema, AssignmentDTO } from './assignment/types';
import { AttributeSchema, AttributesDTO } from './attribute/types';

// External
export const PersonSchema = z
  .object({
    intressent_id: z.string().nonempty(), //Primary key
    sourceid: z.uuid(),
    fodd_ar: z.string().nullish(),
    kon: z.string(),
    efternamn: z.string(),
    tilltalsnamn: z.string(),
    parti: z.string(),
    valkrets: z.string(),
    status: z.string(),
    person_url_xml: z.string().nullish(),
    bild_url_max: z.string().nullish(),
    personuppdrag: AssignmentSchema,
    personuppgift: AttributeSchema,
  })
  .passthrough(); // retain extra source fields for the per-person checksum

export const PersonApiResponseSchema = z
  .object({
    personlista: z.object({
      '@hits': z.coerce.number().int().nonnegative(),
      '@systemdatum': z.string(),
      person: z
        .union([z.array(PersonSchema), PersonSchema])
        .transform((value) => (Array.isArray(value) ? value : [value])),
    }),
  })
  .strip();

// Internal
export const PersonDTO = z
  .object({
    personId: z.string().nonempty(), //intressent_id
    sourceId: z.uuid().nonempty(),
    partyCode: z.string().nonempty(),
    constituency: z.string().nonempty(),
    givenName: z.string(),
    lastName: z.string(),
    gender: z.string(),
    birthYear: z.number().nullable(), // normalized to Date|null
    status: z.string().nullable(),
    politicianUrl: z.string().nullable(),
    imageMax: z.string().nullable(),
    assignments: z.array(AssignmentDTO),
    attributes: z.array(AttributesDTO),
  })
  .strict();

export type PersonDTO = z.infer<typeof PersonDTO>;
