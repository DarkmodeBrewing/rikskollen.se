import {
  PersonApiResponseSchema,
  type PersonDTOType,
} from '@rikskollen/shared-types';
import { workerEnv } from '@rikskollen/shared-types';
import { mapToPoliticianDto } from '@rikskollen/db';
import { fetchJson } from '../lib/http';

export const getPersons = async (): Promise<{
  items: PersonDTOType[];
}> => {
  const baseURL = workerEnv().RIKSDAG_API_URL;

  const segment = '/personlista/';
  const parameters = ['utformat=json', 'sort=sorteringsnamn', 'sortorder=asc'];

  const politicianUrl = new URL(segment, baseURL);
  politicianUrl.search = parameters.join('&');

  const data = await fetchJson(politicianUrl.toString(), PersonApiResponseSchema);

  const items = data.personlista.person.map(mapToPoliticianDto);
  return { items };
};
