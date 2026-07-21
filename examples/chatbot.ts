/**
 * Chatbot-style BaseMemory loop (no LLM — prints recalled context).
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-chatbot",
    storage: sqlite("./examples-chatbot.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  const chatMemory = createWolbargMemory({
    memory,
    agent: "chatbot",
    sessionId: "chat-1",
    topK: 5,
  });

  const turns = [
    ["My name is Ada", "Nice to meet you, Ada."],
    ["I like espresso", "I'll remember you like espresso."],
    ["What do you know about me?", "(see recalled history below)"],
  ] as const;

  for (const [user, assistant] of turns) {
    const vars = await chatMemory.loadMemoryVariables({ input: user });
    console.log("\nuser:", user);
    console.log("memory:", vars.history || "(empty)");
    await chatMemory.saveContext({ input: user }, { output: assistant });
  }

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
