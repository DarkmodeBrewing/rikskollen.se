import { request } from 'undici';
import { z } from 'zod';
import { politiciansScheme } from '@rikskollen/db';
import { env } from '../env';

const baseURL = env.RIKSDAG_API_URL;
const segment = '/personlista/';
const parameters = ['utformat=json', 'sort=sorteringsnamn', 'sortorder=asc'];

// /?iid=&fnamn=&enamn=&f_ar=&kn=&parti=&valkrets=&rdlstatus=&org=&termlista=

export const politicianResponseSchema = z.object({
  personlista: z.object({ person: z.array(politiciansScheme) }),
});

export const fetchPoliticiansForMandate = async () => {
  const politicianUrl = `${baseURL}${segment}?${parameters.join('?')}`;

  const { statusCode, headers, body } = await request(politicianUrl);

  if (statusCode === 200) {
    const data = (await body.json()) as any;

    console.log(JSON.stringify(data['personlista'].person[0]));
  }
};
