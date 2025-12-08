import { getVoteCases } from './clients/vote-case';

(async () => {
  const votecases = await getVoteCases();
  console.log(JSON.stringify(votecases.items));
})();
