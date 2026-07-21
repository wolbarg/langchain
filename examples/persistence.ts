/**
 * Persistence: put in WolbargStore, reopen process-local store, search/get.
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargStore } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const dbPath = "./examples-persistence.db";

  const memory = wolbarg({
    organization: "langchain-persistence",
    storage: sqlite(dbPath),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  const store = createWolbargStore({ memory, agent: "assistant" });
  await store.put(["users", "u1"], "prefs", {
    text: "dark mode",
    theme: "dark",
  });
  await memory.close();

  const memory2 = wolbarg({
    organization: "langchain-persistence",
    storage: sqlite(dbPath),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory2.ready();

  const store2 = createWolbargStore({ memory: memory2, agent: "assistant" });
  const hits = await store2.search(["users"], { query: "UI theme" });
  console.log("after reopen:", hits);

  await memory2.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
