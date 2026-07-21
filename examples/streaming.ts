/**
 * Streaming-shaped flow: recall before "stream", remember after finish.
 * (No real LLM stream — mirrors the middleware finish-then-remember pattern.)
 */

import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "../src/index.js";

async function* fakeStream(text: string): AsyncGenerator<string> {
  for (const word of text.split(" ")) {
    yield `${word} `;
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  const memory = wolbarg({
    organization: "langchain-streaming",
    storage: sqlite("./examples-streaming.db"),
    embedding: openaiEmbedding({ apiKey, model: "text-embedding-3-small" }),
  });
  await memory.ready();

  await memory.remember({
    agent: "assistant",
    content: { text: "User prefers concise answers." },
  });

  const chatMemory = createWolbargMemory({
    memory,
    agent: "assistant",
    sessionId: "stream-1",
  });

  const user = "Keep it short — what do I prefer?";
  const vars = await chatMemory.loadMemoryVariables({ input: user });
  console.log("pre-stream memory:", vars.history || "(empty)");

  const reply = "You prefer concise answers.";
  process.stdout.write("assistant: ");
  for await (const chunk of fakeStream(reply)) {
    process.stdout.write(chunk);
  }
  process.stdout.write("\n");

  // Remember only after the "stream" finishes (cancel-before-finish would skip).
  await chatMemory.saveContext({ input: user }, { output: reply });

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
