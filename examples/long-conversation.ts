/**
 * Long conversation — many saveContext turns, then a summarizing recall.
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-long",
    storage: sqlite("./examples-long-conversation.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  const chatMemory = createWolbargMemory({
    memory,
    agent: "assistant",
    sessionId: "long-1",
    topK: 8,
  });

  const facts = [
    "I live in Berlin",
    "I drink oat milk lattes",
    "My dog is named Pixel",
    "I ship on Fridays",
    "I use Neovim",
  ];

  for (const fact of facts) {
    await chatMemory.saveContext(
      { input: fact },
      { output: `Remembered: ${fact}` },
    );
  }

  const vars = await chatMemory.loadMemoryVariables({
    input: "Summarize what you know about me",
  });
  console.log(vars.history);

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
