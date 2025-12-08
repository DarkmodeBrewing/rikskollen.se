import z from 'zod';

// External
export const VoteRollCallSchema = z
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

// Internal
export const VoteRollCallDTO = z.object({
  voteId: z.uuid().nonempty(),
  rm: z.string().nonempty(),
  beteckning: z.string(),
  punkt: z.string(),
  dokId: z.string(),
  mainVoteType: z.string(),
  subjectType: z.string(),
});
export type VoteRollCallDTO = z.infer<typeof VoteRollCallDTO>;
