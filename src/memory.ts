/**
 * WolbargMemory — LangChain BaseMemory adapter.
 */

import {
  BaseMemory,
  getInputValue,
  getOutputValue,
  type InputValues,
  type MemoryVariables,
  type OutputValues,
} from "@langchain/core/memory";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { RecallResult, Wolbarg } from "wolbarg";
import { defaultFormatContext } from "./format-context.js";
import {
  assertMemoryAndAgent,
  buildProvenanceMetadata,
} from "./options.js";
import { softFail } from "./soft-fail.js";
import type { WolbargMemoryOptions } from "./types.js";

function coerceToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    typeof (value as { content: unknown }).content === "string"
  ) {
    return (value as { content: string }).content;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class WolbargMemory extends BaseMemory {
  readonly memory: Wolbarg;
  readonly agent: string;
  readonly memoryKey: string;
  readonly inputKey?: string;
  readonly outputKey?: string;
  readonly topK: number;
  readonly threshold?: number;
  readonly returnMessages: boolean;
  readonly formatContext: (hits: RecallResult[]) => string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly tags?: string[];
  readonly namespace?: string;
  readonly metadata: Record<string, unknown>;
  readonly filter?: WolbargMemoryOptions["filter"];
  readonly rememberMode: "raw" | "extract";
  readonly rawStrategy: NonNullable<WolbargMemoryOptions["rawStrategy"]>;
  readonly onError?: WolbargMemoryOptions["onError"];

  constructor(options: WolbargMemoryOptions) {
    super();
    assertMemoryAndAgent(options, "WolbargMemory");
    this.memory = options.memory;
    this.agent = options.agent.trim();
    this.memoryKey = options.memoryKey ?? "history";
    this.topK = options.topK ?? 5;
    this.returnMessages = options.returnMessages === true;
    this.formatContext = options.formatContext ?? defaultFormatContext;
    this.metadata = { ...(options.metadata ?? {}) };
    this.rememberMode = options.rememberMode ?? "raw";
    this.rawStrategy = options.rawStrategy ?? "last_user";

    if (options.inputKey !== undefined) this.inputKey = options.inputKey;
    if (options.outputKey !== undefined) this.outputKey = options.outputKey;
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.sessionId !== undefined) this.sessionId = options.sessionId;
    if (options.userId !== undefined) this.userId = options.userId;
    if (options.tags !== undefined) this.tags = options.tags;
    if (options.namespace !== undefined) this.namespace = options.namespace;
    if (options.filter !== undefined) this.filter = options.filter;
    if (options.onError) this.onError = options.onError;
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    let query = "";
    try {
      query = coerceToString(getInputValue(values, this.inputKey)).trim();
    } catch (error) {
      // Ambiguous inputs — soft-fail to empty memory.
      try {
        this.onError?.(error, "recall");
      } catch {
        // ignore
      }
      return { [this.memoryKey]: this.returnMessages ? [] : "" };
    }

    if (!query) {
      return { [this.memoryKey]: this.returnMessages ? [] : "" };
    }

    const hits = await softFail(
      "recall",
      this.onError,
      async () =>
        this.memory.recall({
          query,
          topK: this.topK,
          ...(this.threshold !== undefined ? { threshold: this.threshold } : {}),
          filter: {
            ...(this.filter ?? {}),
            agent: this.agent,
          },
        }),
      [] as RecallResult[],
    );

    if (this.returnMessages) {
      const messages: BaseMessage[] = hits.map(
        (hit) => new HumanMessage(hit.content.text),
      );
      return { [this.memoryKey]: messages };
    }

    const formatted = await softFail(
      "recall",
      this.onError,
      async () => this.formatContext(hits),
      "",
    );
    return { [this.memoryKey]: formatted };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues,
  ): Promise<void> {
    let input = "";
    let output = "";
    try {
      input = coerceToString(getInputValue(inputValues, this.inputKey)).trim();
      output = coerceToString(
        getOutputValue(outputValues, this.outputKey),
      ).trim();
    } catch (error) {
      try {
        this.onError?.(error, "remember");
      } catch {
        // ignore
      }
      return;
    }

    if (!input && !output) return;

    const messages = [
      ...(input ? [{ role: "user", content: input }] : []),
      ...(output ? [{ role: "assistant", content: output }] : []),
    ];

    // Prefer rememberFromMessages when we have a user turn; otherwise remember AI text.
    await softFail(
      "remember",
      this.onError,
      async () => {
        if (input) {
          await this.memory.rememberFromMessages(messages, {
            agent: this.agent,
            mode: this.rememberMode,
            rawStrategy: this.rawStrategy,
            metadata: buildProvenanceMetadata(this),
          });
        } else if (output) {
          await this.memory.remember({
            agent: this.agent,
            content: { text: output },
            metadata: buildProvenanceMetadata(this),
          });
        }
      },
      undefined,
    );
  }
}

/** Factory for {@link WolbargMemory}. */
export function createWolbargMemory(options: WolbargMemoryOptions): WolbargMemory {
  return new WolbargMemory(options);
}
