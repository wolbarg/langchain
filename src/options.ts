/**
 * Shared option helpers for LangChain adapters.
 */

import {
  WOLBARG_LANGCHAIN_SOURCE,
  type WolbargMemoryOptions,
  type WolbargStoreOptions,
  type WolbargToolsOptions,
} from "./types.js";

export function assertMemoryAndAgent(
  options: { memory?: unknown; agent?: unknown },
  label: string,
): void {
  if (!options?.memory) {
    throw new Error(`@wolbarg/langchain: ${label} memory is required`);
  }
  if (typeof options.agent !== "string" || options.agent.trim().length === 0) {
    throw new Error(
      `@wolbarg/langchain: ${label} agent must be a non-empty string`,
    );
  }
}

export function buildProvenanceMetadata(
  options: Pick<
    WolbargMemoryOptions | WolbargStoreOptions | WolbargToolsOptions,
    "sessionId" | "userId" | "tags" | "metadata"
  > & { namespace?: string },
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const meta: Record<string, unknown> = { ...(options.metadata ?? {}) };
  if (options.sessionId !== undefined) meta.sessionId = options.sessionId;
  if (options.userId !== undefined) meta.userId = options.userId;
  if (options.tags !== undefined) meta.tags = options.tags;
  if (options.namespace !== undefined) meta.namespace = options.namespace;
  meta.source = WOLBARG_LANGCHAIN_SOURCE;
  if (extra) Object.assign(meta, extra);
  return meta;
}

/** Serialize LangGraph namespace path for Wolbarg metadata filters. */
export function namespaceToMeta(namespace: string[]): string {
  return JSON.stringify(namespace);
}

export function metaToNamespace(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((p) => typeof p === "string")
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return raw.length > 0 ? raw.split("/") : [];
}

/** Prefer value.text / value.data; otherwise JSON.stringify. */
export function valueToText(value: Record<string, unknown>): string {
  if (typeof value.text === "string" && value.text.trim().length > 0) {
    return value.text;
  }
  if (typeof value.data === "string" && value.data.trim().length > 0) {
    return value.data;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function indexKey(namespace: string[], key: string): string {
  return `${namespaceToMeta(namespace)}\0${key}`;
}
