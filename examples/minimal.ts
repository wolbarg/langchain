/**
 * Minimal WolbargMemory load/save.
 *
 * Requires OPENAI_API_KEY. Illustrative — not run in CI.
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-minimal",
    storage: sqlite("./examples-minimal.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  const chatMemory = createWolbargMemory({
    memory,
    agent: "assistant",
    sessionId: "minimal-1",
  });

  await chatMemory.saveContext(
    { input: "I prefer dark mode" },
    { output: "Noted." },
  );

  const vars = await chatMemory.loadMemoryVariables({
    input: "What theme do I like?",
  });
  console.log(vars.history);

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
