/**
 * Test doubles for Wolbarg.
 */

import type {
  ConversationMessage,
  MemoryRecord,
  RecallResult,
  RememberResult,
} from "wolbarg";

export type MockMemoryCalls = {
  recalls: Array<{
    query: string;
    filter?: unknown;
    topK?: number;
  }>;
  remembers: Array<{
    agent: string;
    content: { text: string };
    metadata?: Record<string, unknown>;
  }>;
  rememberFromMessages: Array<{
    messages: ConversationMessage[];
    options: unknown;
  }>;
  forgets: Array<{ id?: string; filter?: unknown }>;
};

function baseRecord(
  partial: Partial<MemoryRecord> & { id: string; content: { text: string } },
): MemoryRecord {
  return {
    organization: "test",
    agent: "assistant",
    metadata: {},
    archived: false,
    compressedInto: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

export function createMockMemory(options?: {
  hits?: RecallResult[];
  recallError?: Error;
  rememberError?: Error;
  forgetError?: Error;
  rememberResults?: RememberResult[];
  recallImpl?: (opts: {
    query: string;
    topK?: number;
    filter?: unknown;
  }) => Promise<RecallResult[]>;
}): {
  memory: {
    recall: (opts: {
      query: string;
      topK?: number;
      threshold?: number;
      filter?: unknown;
    }) => Promise<RecallResult[]>;
    remember: (opts: {
      agent: string;
      content: { text: string };
      metadata?: Record<string, unknown>;
    }) => Promise<RememberResult>;
    rememberFromMessages: (
      messages: ConversationMessage[],
      opts: unknown,
    ) => Promise<RememberResult[]>;
    forget: (opts: { id?: string; filter?: unknown }) => Promise<number>;
  };
  calls: MockMemoryCalls;
} {
  const calls: MockMemoryCalls = {
    recalls: [],
    remembers: [],
    rememberFromMessages: [],
    forgets: [],
  };
  const hits = options?.hits ?? [];
  let rememberCounter = 0;

  return {
    calls,
    memory: {
      async recall(opts) {
        calls.recalls.push({
          query: opts.query,
          filter: opts.filter,
          topK: opts.topK,
        });
        if (options?.recallError) throw options.recallError;
        if (options?.recallImpl) return options.recallImpl(opts);
        return hits;
      },
      async remember(opts) {
        calls.remembers.push(opts);
        if (options?.rememberError) throw options.rememberError;
        rememberCounter += 1;
        const id = `mem-${rememberCounter}`;
        return {
          ...baseRecord({
            id,
            content: opts.content,
            agent: opts.agent,
            metadata: opts.metadata ?? {},
          }),
          action: "created" as const,
        };
      },
      async rememberFromMessages(messages, opts) {
        calls.rememberFromMessages.push({ messages, options: opts });
        if (options?.rememberError) throw options.rememberError;
        return (
          options?.rememberResults ??
          messages
            .filter((m) => m.role === "user")
            .map((m, i) => ({
              ...baseRecord({
                id: `mem-msg-${i}`,
                content: { text: m.content },
              }),
              action: "created" as const,
            }))
        );
      },
      async forget(opts) {
        calls.forgets.push(opts);
        if (options?.forgetError) throw options.forgetError;
        return opts.id ? 1 : 0;
      },
    },
  };
}

export function fakeHit(
  text: string,
  overrides?: Partial<RecallResult>,
): RecallResult {
  return {
    ...baseRecord({
      id: overrides?.id ?? `hit-${text.slice(0, 8)}`,
      content: { text },
      metadata: overrides?.metadata ?? {},
    }),
    similarity: overrides?.similarity ?? 0.9,
    ...overrides,
    content: { text },
  };
}
