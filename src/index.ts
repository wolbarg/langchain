/**
 * @wolbarg/langchain — Official LangChain JS / LangGraph JS adapters for Wolbarg.
 *
 * - {@link WolbargMemory} — `@langchain/core` `BaseMemory` (legacy chain memory)
 * - {@link WolbargStore} — LangGraph `BaseStore` (preferred long-term memory)
 *
 * @example
 * ```ts
 * import { createWolbargMemory, createWolbargStore } from "@wolbarg/langchain";
 *
 * const memory = createWolbargMemory({ memory: wolbarg, agent: "assistant" });
 * const store = createWolbargStore({ memory: wolbarg, agent: "assistant" });
 * ```
 *
 * @packageDocumentation
 */

export {
  WolbargMemory,
  createWolbargMemory,
} from "./memory.js";
export {
  WolbargStore,
  createWolbargStore,
} from "./store.js";
export { createWolbargTools } from "./tools.js";
export { defaultFormatContext } from "./format-context.js";
export {
  WOLBARG_LANGCHAIN_SOURCE,
  WOLBARG_MEMORY_CONTENT_MARKER,
  type WolbargLangChainErrorPhase,
  type WolbargMemoryOptions,
  type WolbargStoreOptions,
  type WolbargToolsOptions,
} from "./types.js";
