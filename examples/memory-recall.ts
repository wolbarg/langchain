/**
 * Memory recall demo — seed facts, then loadMemoryVariables.
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-recall",
    storage: sqlite("./examples-memory-recall.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  await memory.remember({
    agent: "assistant",
    content: { text: "The user prefers dark mode in the IDE." },
  });
  await memory.remember({
    agent: "assistant",
    content: { text: "The user works primarily in TypeScript." },
  });

  const chatMemory = createWolbargMemory({
    memory,
    agent: "assistant",
    topK: 3,
  });

  const vars = await chatMemory.loadMemoryVariables({
    input: "What are my editor preferences?",
  });
  console.log(vars.history);

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
