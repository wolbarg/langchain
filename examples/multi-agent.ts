/**
 * Multi-agent: shared Wolbarg, separate agent ids + store namespaces.
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory, createWolbargStore } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-multi-agent",
    storage: sqlite("./examples-multi-agent.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  const researcher = createWolbargMemory({
    memory,
    agent: "researcher",
  });
  const writer = createWolbargMemory({
    memory,
    agent: "writer",
  });
  const store = createWolbargStore({ memory, agent: "shared-store" });

  await researcher.saveContext(
    { input: "Key fact: SQLite is enough for local agent memory" },
    { output: "Stored research note." },
  );
  await store.put(["project", "notes"], "thesis", {
    text: "Shared memory scales faster than adding agents",
  });

  const writerCtx = await writer.loadMemoryVariables({
    input: "What should I emphasize about memory?",
  });
  const shared = await store.search(["project"], {
    query: "shared memory",
  });

  console.log("writer recall (agent-scoped):", writerCtx.history);
  console.log("shared store hits:", shared.map((h) => h.value));

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
