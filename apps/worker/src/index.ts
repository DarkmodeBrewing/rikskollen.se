import "dotenv/config";
import { upsertItemFromUpstream } from "@rikskollen.se/db";


async function run() {
  console.log("Starting sync…");

  const response = await fetch("https://some-api.example.com/items");
  if (!response.ok) {
    console.error("Upstream error", response.status);
    process.exit(1);
  }

  const items = (await response.json()) as { id: string; title: string }[];

  for (const item of items) {
    upsertItemFromUpstream(item);
  }

  console.log(`Synced ${items.length} items.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
