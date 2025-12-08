import {
  VoteCaseSchema,
  VoteCaseDTO,
  type VoteCaseDTO as VoteCaseDTOType,
} from '@rikskollen/shared-types';

import type z from 'zod';

// small, pure mapper keeps routes clean
export const mapToVoteCaseDto = (
  input: z.infer<typeof VoteCaseSchema>,
): VoteCaseDTOType =>
  VoteCaseDTO.parse({
    voteId: input.votering_id,
    rm: input.rm,
    beteckning: input.beteckning,
    punkt: input.punkt,
    dokId: input.dok_id,
    mainVoteType: input.votering,
    subjectType: input.avser,
  });
