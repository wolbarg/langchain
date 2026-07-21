/**
 * Public types for @wolbarg/langchain.
 */

import type {
  MemoryFilter,
  RecallResult,
  RememberFromMessagesRawStrategy,
  Wolbarg,
} from "wolbarg";

export const WOLBARG_LANGCHAIN_SOURCE = "wolbarg-langchain" as const;

/** Invisible-separator wrapped token — unlikely to collide with user prompts. */
export const WOLBARG_MEMORY_CONTENT_MARKER = "\u2063wolbarg:memory\u2063";

export type WolbargLangChainErrorPhase =
  | "recall"
  | "remember"
  | "get"
  | "put"
  | "delete"
  | "search"
  | "listNamespaces";

export type WolbargMemoryOptions = {
  memory: Wolbarg;
  agent: string;
  /** Memory variable key returned from `loadMemoryVariables`. Defaults to `"history"`. */
  memoryKey?: string;
  inputKey?: string;
  outputKey?: string;
  topK?: number;
  threshold?: number;
  /** When true, return `BaseMessage[]` instead of a formatted string. */
  returnMessages?: boolean;
  formatContext?: (hits: RecallResult[]) => string;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  namespace?: string;
  metadata?: Record<string, unknown>;
  filter?: MemoryFilter;
  rememberMode?: "raw" | "extract";
  rawStrategy?: RememberFromMessagesRawStrategy;
  onError?: (error: unknown, phase: WolbargLangChainErrorPhase) => void;
};

export type WolbargStoreOptions = {
  memory: Wolbarg;
  agent: string;
  topK?: number;
  threshold?: number;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  /** Extra metadata merged into every put. */
  metadata?: Record<string, unknown>;
  onError?: (error: unknown, phase: WolbargLangChainErrorPhase) => void;
};

export type WolbargToolsOptions = {
  memory: Wolbarg;
  agent: string;
  topK?: number;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  namespace?: string;
  metadata?: Record<string, unknown>;
  onError?: (error: unknown, phase: WolbargLangChainErrorPhase) => void;
};
