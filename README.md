# @wolbarg/langchain

[![npm version](https://img.shields.io/npm/v/@wolbarg/langchain.svg)](https://www.npmjs.com/package/@wolbarg/langchain)
[![GitHub](https://img.shields.io/badge/github-wolbarg%2Flangchain-black?logo=github)](https://github.com/wolbarg/langchain)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Official [LangChain JS](https://js.langchain.com/) / [LangGraph JS](https://langchain-ai.github.io/langgraphjs/) adapters for [Wolbarg](https://wolbarg.com) shared memory.

Two integration surfaces:

1. **`WolbargMemory`** — `@langchain/core` `BaseMemory` (legacy chain memory: recall on load, remember on save)
2. **`WolbargStore`** — LangGraph `BaseStore` (preferred long-term memory for multi-agent / durable graphs)

Soft-fail by default: recall/remember/store errors never crash the chain or graph (`onError` optional). Provenance metadata always includes `source: "wolbarg-langchain"`.

## Install

```bash
npm install wolbarg @wolbarg/langchain @langchain/core @langchain/langgraph
```

Peers: `wolbarg >= 0.5.4`, `@langchain/core >= 0.3 || >= 1`, `@langchain/langgraph >= 0.2 || >= 1`. Node **≥ 22**.

## Quick start — BaseMemory

```ts
import { wolbarg, sqlite, openaiEmbedding } from "wolbarg";
import { createWolbargMemory } from "@wolbarg/langchain";

const memory = wolbarg({
  organization: "my-app",
  storage: sqlite("./memory.db"),
  embedding: openaiEmbedding({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "text-embedding-3-small",
  }),
});
await memory.ready();

const chatMemory = createWolbargMemory({
  memory,
  agent: "assistant",
  memoryKey: "history",
  sessionId: "chat-1",
});

const vars = await chatMemory.loadMemoryVariables({
  input: "What UI theme do I prefer?",
});
// vars.history — formatted string (or BaseMessage[] when returnMessages: true)

await chatMemory.saveContext(
  { input: "I prefer dark mode" },
  { output: "Noted — dark mode it is." },
);
```

## Quick start — LangGraph BaseStore

```ts
import { createWolbargStore } from "@wolbarg/langchain";

const store = createWolbargStore({
  memory,
  agent: "assistant",
});

await store.put(["users", "u1"], "prefs", { text: "dark mode" });
const item = await store.get(["users", "u1"], "prefs");
const hits = await store.search(["users"], {
  query: "theme preference",
  limit: 5,
});
```

Pass `store` into LangGraph as the long-term memory store (e.g. graph compile / store config). Prefer **`WolbargStore`** for new LangGraph apps; use **`WolbargMemory`** when you still need classic `BaseMemory` chains.

## Optional tools

```ts
import { createWolbargTools } from "@wolbarg/langchain";

const tools = createWolbargTools({ memory, agent: "assistant" });
// [wolbarg_recall, wolbarg_remember]
```

## API Reference

### `WolbargMemory` / `createWolbargMemory`

| Option | Default | Notes |
| --- | --- | --- |
| `memory` | required | Wolbarg instance |
| `agent` | required | Agent id for recall/remember filters |
| `memoryKey` | `"history"` | Key returned from `loadMemoryVariables` |
| `inputKey` / `outputKey` | auto | Passed to LangChain `getInputValue` / `getOutputValue` |
| `topK` | `5` | Recall limit |
| `returnMessages` | `false` | Return `HumanMessage[]` instead of a string |
| `formatContext` | default formatter | Custom string formatter for hits |
| `rememberMode` | `"raw"` | Passed to `rememberFromMessages` |
| `sessionId` / `userId` / `tags` / `namespace` / `metadata` | — | Copied onto stored metadata |
| `onError` | — | Soft-fail hook |

### `WolbargStore` / `createWolbargStore`

| Method | Wolbarg mapping |
| --- | --- |
| `put` | `remember` (text from `value.text` / `value.data` / `JSON.stringify`) |
| `get` | metadata key lookup (+ process cache) |
| `delete` | `forget` by memory id |
| `search` (+ `query`) | `recall` |
| `batch` | abstract entry point (put/get/delete/search/listNamespaces) |

Namespaces are stored in Wolbarg metadata (`storeNamespace`, `storeKey`, `storeValue`).

## Configuration

Keep options small: required `memory` + `agent`, then optional scoping (`sessionId`, `userId`, `tags`, `namespace`) and recall knobs (`topK`, `threshold`). Prefer one shared Wolbarg client per process.

## Production Notes

- Soft-fail by default — wire `onError` to your logger/metrics.
- Prefer **`WolbargStore`** for LangGraph long-term memory; use `WolbargMemory` only for legacy chain `memory:` slots.
- Share one Wolbarg instance across graph nodes/agents (SQLite file or Postgres).
- Provenance is always `source: "wolbarg-langchain"`.

## Limitations

- `BaseMemory` is legacy in LangChain 1.x / LangGraph apps.
- Exact `get`/`delete` after restart is best-effort via metadata-filtered recall; in-process cache is authoritative within a run.
- `listNamespaces` only reflects namespaces seen in this process.
- Does not replace LangGraph checkpointers (short-term thread state).

## Migration Guide

| From | To |
| --- | --- |
| `BufferMemory` / custom `BaseMemory` | `createWolbargMemory({ memory, agent })` |
| `InMemoryStore` / Postgres store for semantic facts | `createWolbargStore({ memory, agent })` + `compile({ store })` |
| Manual `recall`/`remember` in nodes | Prefer store + tools, or call Wolbarg directly in nodes |

## Examples

Package: `examples/` (minimal, chatbot, multi-agent, persistence, memory-recall, long-conversation, streaming).

Repo adapter: `examples/adapters/langchain/`.

## Docs

https://wolbarg.com/docs/integrations/langchain

## License

MIT
