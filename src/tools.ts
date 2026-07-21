/**
 * Optional LangChain tools for recall / remember.
 */

import { tool } from "@langchain/core/tools";
import type { RecallResult } from "wolbarg";
import { defaultFormatContext } from "./format-context.js";
import {
  assertMemoryAndAgent,
  buildProvenanceMetadata,
} from "./options.js";
import { softFail } from "./soft-fail.js";
import type { WolbargToolsOptions } from "./types.js";

/**
 * Returns LangChain tools that wrap Wolbarg `recall` and `remember`.
 * Soft-fails to empty / error strings so tool-calling agents keep running.
 */
export function createWolbargTools(options: WolbargToolsOptions) {
  assertMemoryAndAgent(options, "createWolbargTools");
  const agent = options.agent.trim();
  const topK = options.topK ?? 5;

  const recallTool = tool(
    async ({ query }: { query: string }) => {
      const hits = await softFail(
        "recall",
        options.onError,
        async () =>
          options.memory.recall({
            query,
            topK,
            filter: { agent },
          }),
        [] as RecallResult[],
      );
      const text = await softFail(
        "recall",
        options.onError,
        async () => defaultFormatContext(hits),
        "",
      );
      return text.trim().length > 0 ? text : "No relevant memories found.";
    },
    {
      name: "wolbarg_recall",
      description:
        "Recall relevant long-term memories from Wolbarg for a natural-language query.",
      schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language search query",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  );

  const rememberTool = tool(
    async ({ content }: { content: string }) => {
      const ok = await softFail(
        "remember",
        options.onError,
        async () => {
          await options.memory.remember({
            agent,
            content: { text: content },
            metadata: buildProvenanceMetadata(options),
          });
          return true;
        },
        false,
      );
      return ok ? "Memory stored." : "Failed to store memory.";
    },
    {
      name: "wolbarg_remember",
      description: "Store a fact or preference into Wolbarg long-term memory.",
      schema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Text to remember",
          },
        },
        required: ["content"],
        additionalProperties: false,
      },
    },
  );

  return [recallTool, rememberTool] as const;
}
