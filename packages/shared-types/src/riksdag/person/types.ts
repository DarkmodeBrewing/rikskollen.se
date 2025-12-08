import z from 'zod';
import { AssignmentSchema, AssingmentDTO } from './assignment/types';
import { AttributeSchema, AttributesDTO } from './attribute/types';

// External
export const PersonSchema = z
  .object({
    intressent_id: z.string().nonempty(), //Primary key
    sourceid: z.uuid(),
    fodd_ar: z.string(),
    kon: z.string(),
    efternamn: z.string(),
    tilltalsnamn: z.string(),
    parti: z.string(),
    valkrets: z.string(),
    status: z.string(),
    person_url_xml: z.url().optional().default(''),
    personuppdrag: AssignmentSchema,
    personuppgift: AttributeSchema,
  })
  .strip(); // ignore the many extra keys

export const PersonApiResponseSchema = z
  .object({
    personlista: z.object({
      person: z.array(PersonSchema),
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
    politicianUrl: z.url().nullable(),
    assignments: z.array(AssingmentDTO),
    attributes: z.array(AttributesDTO),
  })
  .strict();

export type PersonDTO = z.infer<typeof PersonDTO>;
