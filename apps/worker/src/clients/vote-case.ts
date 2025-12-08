import {
  VoteApiResponseSchema,
  type VoteCaseDTO as VoteCaseDTOType,
  apiEnv,
} from '@rikskollen/shared-types';
import { mapToVoteCaseDto } from '@rikskollen/db';
import { fetchJson } from '../lib/http';

export type VoteCasesResult =
  | { ok: true; items: VoteCaseDTOType[] }
  | { ok: false; error: Error; items: VoteCaseDTOType[] };

export const getVoteCases = async (): Promise<VoteCasesResult> => {
  const baseURL = apiEnv().RIKSDAG_API_URL;
  const segment = '/voteringlista/';

  const url = new URL(segment, baseURL);
  const params = url.searchParams;

  // riksmöten
  ['2025/26', '2024/25', '2023/24', '2022/23'].forEach((rm) => {
    params.append('rm', rm);
  });

  params.set('utformat', 'json');
  params.set('sz', '10'); // or "10000" later

  try {
    const data = await fetchJson(url.toString(), VoteApiResponseSchema);
    const items = data.voteringlista.votering.map(mapToVoteCaseDto);

    return { ok: true, items };
  } catch (e) {
    console.error('[getVoteCases] error:', e);
    return {
      ok: false,
      error: e instanceof Error ? e : new Error('Unknown error'),
      items: [],
    };
  }
};
