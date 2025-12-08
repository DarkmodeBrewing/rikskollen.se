import z from 'zod';

// External
export const VoteCaseSchema = z
  .object({
    votering_id: z.string(),
    rm: z.string(),
    beteckning: z.string(),
    punkt: z.string(),
    avser: z.string(),
    dok_id: z.string(),
    votering: z.string(),
  })
  .strip(); // ignore the many extra keys

export const VoteApiResponseSchema = z
  .object({
    voteringlista: z.object({
      votering: z.array(VoteCaseSchema),
    }),
  })
  .strip();

// Internal
export const VoteCaseDTO = z.object({
  voteId: z.uuid().nonempty(),
  rm: z.string().nonempty(),
  beteckning: z.string(),
  punkt: z.string(),
  dokId: z.string(),
  mainVoteType: z.string(),
  subjectType: z.string(),
});

export type VoteCaseDTO = z.infer<typeof VoteCaseDTO>;
