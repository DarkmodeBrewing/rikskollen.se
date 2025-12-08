import {
  PersonSchema,
  PersonDTO,
  AssingmentDTO,
  AttributesDTO,
  type AssignmentSchema,
  type AttributeSchema,
  type PersonDTO as PersonDTOType,
} from '@rikskollen/shared-types';

import type z from 'zod';

// small, pure mapper keeps routes clean
export const mapToPoliticianDto = (
  input: z.infer<typeof PersonSchema>,
): PersonDTOType =>
  PersonDTO.parse({
    personId: input.intressent_id,
    sourceId: input.sourceid,
    partyCode: input.parti,
    constituency: input.valkrets,
    givenName: input.tilltalsnamn,
    lastName: input.efternamn,
    gender: input.kon,
    birthYear: Number(input.fodd_ar),
    status: input.status,
    politicianUrl: input.person_url_xml,
    imageMax: input.bild_url_max,
    assignments: toAssignmentDto(input.personuppdrag),
    attributes: toAttributesDto(input.personuppgift),
  });

const toAttributesDto = (input: z.infer<typeof AttributeSchema>) =>
  input?.uppgift?.map((attribute) =>
    AttributesDTO.parse({
      personId: attribute.intressent_id,
      code: attribute.kod,
      kind: attribute.typ,
      value: attribute.uppgift,
    }),
  );

const toAssignmentDto = (input: z.infer<typeof AssignmentSchema>) =>
  input?.uppdrag?.map((assignment) =>
    AssingmentDTO.parse({
      personId: assignment.intressent_id,
      organCode: assignment.organ_kod,
      roleCode: assignment.roll_kod,
      kind: assignment.typ,
      status: assignment.status,
      from: assignment.from ? new Date(assignment.from) : null,
      to: assignment.tom ? new Date(assignment.tom) : null,
      value: assignment.uppgift?.[0], // normalized from uppgift[0]
      order: Number(assignment.ordningsnummer),
    }),
  );
