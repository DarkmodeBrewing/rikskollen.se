import { scrapeCurrentMandate } from './jobs/scrapeCurrentMandate';

const main = async (): Promise<void> => {
  await scrapeCurrentMandate();
  process.exit(0);
};

main().catch((error) => {
  console.error('Worker failed', error);
  process.exit(1);
});
