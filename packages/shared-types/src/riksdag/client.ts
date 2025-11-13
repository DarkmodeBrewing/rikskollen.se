import { fetchJson } from '../lib/http';
import type {
  PoliticianSchema,
  PoliticianDTO as PoliticianDTOType,
} from './types';
import { PoliticianDTO, PoliticianResponseSchema } from './types';
import { env } from '../env';

// small, pure mapper keeps routes clean
function toPoliticianDto(input: any): PoliticianDTOType {
  // light normalization here; heavy validation was done by External schema
  const birth =
    typeof input.birthDate === 'string' ? new Date(input.birthDate) : null;

  return PoliticianDTO.parse({
    id: input.id,
    name: input.name,
    party: input.party ?? '',
    district: input.district ?? '',
    birthDate: birth && !isNaN(birth.getTime()) ? birth : null,
    isActive: Boolean(input.active),
  });
}

export async function getPoliticans(): Promise<{
  items: PoliticianDTOType[];
}> {
  const baseURL = env.RIKSDAG_API_URL;
  const segment = '/personlista/';
  const parameters = ['utformat=json', 'sort=sorteringsnamn', 'sortorder=asc'];

  // /?iid=&fnamn=&enamn=&f_ar=&kn=&parti=&valkrets=&rdlstatus=&org=&termlista=
  const politicianUrl = `${baseURL}${segment}?${parameters.join('?')}`;

  const data = await fetchJson(politicianUrl, PoliticianResponseSchema);

  // map down to only what you need
  const items = data.personlista.person.map(toPoliticianDto);
  return { items };
}
