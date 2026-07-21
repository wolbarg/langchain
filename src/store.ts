/**
 * WolbargStore — LangGraph BaseStore adapter backed by Wolbarg semantic memory.
 */

import { BaseStore } from "@langchain/langgraph";
import type {
  GetOperation,
  Item,
  ListNamespacesOperation,
  Operation,
  OperationResults,
  PutOperation,
  SearchItem,
  SearchOperation,
} from "@langchain/langgraph-checkpoint";
import { meta, type RecallResult, type Wolbarg } from "wolbarg";
import {
  assertMemoryAndAgent,
  buildProvenanceMetadata,
  indexKey,
  metaToNamespace,
  namespaceToMeta,
  valueToText,
} from "./options.js";
import { softFail } from "./soft-fail.js";
import type { WolbargStoreOptions } from "./types.js";

type CachedEntry = {
  wolbargId: string;
  item: Item;
};

function isGetOp(op: Operation): op is GetOperation {
  return (
    "key" in op &&
    "namespace" in op &&
    !("value" in op) &&
    !("namespacePrefix" in op)
  );
}

function isSearchOp(op: Operation): op is SearchOperation {
  return "namespacePrefix" in op;
}

function isPutOp(op: Operation): op is PutOperation {
  return "value" in op && "key" in op && "namespace" in op;
}

function isListNamespacesOp(op: Operation): op is ListNamespacesOperation {
  return "limit" in op && "offset" in op && !("key" in op) && !("namespacePrefix" in op);
}

function namespaceMatchesPrefix(
  namespace: string[],
  prefix: string[],
): boolean {
  if (prefix.length === 0) return true;
  if (namespace.length < prefix.length) return false;
  return prefix.every((p, i) => namespace[i] === p);
}

function parseStoredValue(
  hit: RecallResult,
): Record<string, unknown> {
  const raw = hit.metadata?.storeValue;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  return { text: hit.content.text };
}

function hitToItem(hit: RecallResult, fallbackNamespace: string[]): Item {
  const key =
    typeof hit.metadata?.storeKey === "string"
      ? hit.metadata.storeKey
      : hit.id;
  const namespace = metaToNamespace(hit.metadata?.storeNamespace);
  return {
    value: parseStoredValue(hit),
    key,
    namespace: namespace.length > 0 ? namespace : fallbackNamespace,
    createdAt: hit.createdAt,
    updatedAt: hit.updatedAt,
  };
}

function doesMatch(
  matchType: "prefix" | "suffix",
  path: (string | "*")[],
  key: string[],
): boolean {
  if (matchType === "prefix") {
    if (path.length > key.length) return false;
    return path.every(
      (pElem, index) => pElem === "*" || key[index] === pElem,
    );
  }
  if (path.length > key.length) return false;
  return path.every(
    (pElem, index) =>
      pElem === "*" || key[key.length - path.length + index] === pElem,
  );
}

export class WolbargStore extends BaseStore {
  readonly memory: Wolbarg;
  readonly agent: string;
  readonly topK: number;
  readonly threshold?: number;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly tags?: string[];
  readonly metadata: Record<string, unknown>;
  readonly onError?: WolbargStoreOptions["onError"];

  /** Process-local index for exact get/delete (LangGraph key lookup). */
  private readonly cache = new Map<string, CachedEntry>();
  private readonly knownNamespaces = new Set<string>();

  constructor(options: WolbargStoreOptions) {
    super();
    assertMemoryAndAgent(options, "WolbargStore");
    this.memory = options.memory;
    this.agent = options.agent.trim();
    this.topK = options.topK ?? 10;
    this.metadata = { ...(options.metadata ?? {}) };
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.sessionId !== undefined) this.sessionId = options.sessionId;
    if (options.userId !== undefined) this.userId = options.userId;
    if (options.tags !== undefined) this.tags = options.tags;
    if (options.onError) this.onError = options.onError;
  }

  async batch<Op extends Operation[]>(
    operations: Op,
  ): Promise<OperationResults<Op>> {
    const results: unknown[] = new Array(operations.length);

    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i]!;
      if (isGetOp(op)) {
        results[i] = await this.handleGet(op);
      } else if (isSearchOp(op)) {
        results[i] = await this.handleSearch(op);
      } else if (isPutOp(op)) {
        await this.handlePut(op);
        results[i] = undefined;
      } else if (isListNamespacesOp(op)) {
        results[i] = this.handleListNamespaces(op);
      } else {
        results[i] = null;
      }
    }

    return results as OperationResults<Op>;
  }

  private rememberNamespace(namespace: string[]): void {
    this.knownNamespaces.add(namespaceToMeta(namespace));
  }

  private async handleGet(op: GetOperation): Promise<Item | null> {
    const cached = this.cache.get(indexKey(op.namespace, op.key));
    if (cached) return { ...cached.item, value: { ...cached.item.value } };

    return softFail(
      "get",
      this.onError,
      async () => {
        const nsMeta = namespaceToMeta(op.namespace);
        const hits = await this.memory.recall({
          query: `${op.namespace.join("/")}/${op.key}`,
          topK: Math.max(this.topK, 20),
          ...(this.threshold !== undefined
            ? { threshold: this.threshold }
            : {}),
          filter: {
            agent: this.agent,
            metadata: meta.and(
              meta.eq("storeKey", op.key),
              meta.eq("storeNamespace", nsMeta),
            ),
          },
        });

        const hit = hits.find(
          (h) =>
            h.metadata?.storeKey === op.key &&
            h.metadata?.storeNamespace === nsMeta,
        );
        if (!hit) return null;

        const item = hitToItem(hit, op.namespace);
        this.cache.set(indexKey(op.namespace, op.key), {
          wolbargId: hit.id,
          item,
        });
        this.rememberNamespace(op.namespace);
        return item;
      },
      null,
    );
  }

  private async handlePut(op: PutOperation): Promise<void> {
    const value = op.value;
    if (value === null) {
      await this.handleDelete(op.namespace, op.key);
      return;
    }

    await softFail(
      "put",
      this.onError,
      async () => {
        const text = valueToText(value);
        if (!text.trim()) return;

        const nsMeta = namespaceToMeta(op.namespace);
        const existing = this.cache.get(indexKey(op.namespace, op.key));
        if (existing) {
          await softFail(
            "delete",
            this.onError,
            async () => {
              await this.memory.forget({ id: existing.wolbargId });
            },
            undefined,
          );
        }

        const now = new Date();
        const result = await this.memory.remember({
          agent: this.agent,
          content: { text },
          metadata: buildProvenanceMetadata(this, {
            storeKey: op.key,
            storeNamespace: nsMeta,
            storeValue: JSON.stringify(value),
          }),
        });

        const item: Item = {
          value: { ...value },
          key: op.key,
          namespace: [...op.namespace],
          createdAt: existing?.item.createdAt ?? result.createdAt ?? now,
          updatedAt: result.updatedAt ?? now,
        };

        this.cache.set(indexKey(op.namespace, op.key), {
          wolbargId: result.id,
          item,
        });
        this.rememberNamespace(op.namespace);
      },
      undefined,
    );
  }

  private async handleDelete(
    namespace: string[],
    key: string,
  ): Promise<void> {
    await softFail(
      "delete",
      this.onError,
      async () => {
        const cached = this.cache.get(indexKey(namespace, key));
        let wolbargId = cached?.wolbargId;

        if (!wolbargId) {
          const found = await this.handleGet({ namespace, key });
          if (!found) {
            this.cache.delete(indexKey(namespace, key));
            return;
          }
          wolbargId = this.cache.get(indexKey(namespace, key))?.wolbargId;
        }

        if (wolbargId) {
          await this.memory.forget({ id: wolbargId });
        }
        this.cache.delete(indexKey(namespace, key));
      },
      undefined,
    );
  }

  private async handleSearch(op: SearchOperation): Promise<SearchItem[]> {
    const limit = op.limit ?? 10;
    const offset = op.offset ?? 0;

    return softFail(
      "search",
      this.onError,
      async () => {
        if (op.query && op.query.trim()) {
          const hits = await this.memory.recall({
            query: op.query,
            topK: Math.max(limit + offset, this.topK),
            ...(this.threshold !== undefined
              ? { threshold: this.threshold }
              : {}),
            filter: { agent: this.agent },
          });

          let items: SearchItem[] = hits
            .map((hit) => {
              const item = hitToItem(hit, op.namespacePrefix);
              this.rememberNamespace(item.namespace);
              this.cache.set(indexKey(item.namespace, item.key), {
                wolbargId: hit.id,
                item,
              });
              return {
                ...item,
                score: hit.similarity,
              } satisfies SearchItem;
            })
            .filter((item) =>
              namespaceMatchesPrefix(item.namespace, op.namespacePrefix),
            );

          if (op.filter) {
            items = items.filter((item) =>
              Object.entries(op.filter!).every(([k, v]) => item.value[k] === v),
            );
          }

          return items.slice(offset, offset + limit);
        }

        // No query — return cached items under the namespace prefix.
        const fromCache: SearchItem[] = [];
        for (const entry of this.cache.values()) {
          if (!namespaceMatchesPrefix(entry.item.namespace, op.namespacePrefix)) {
            continue;
          }
          if (
            op.filter &&
            !Object.entries(op.filter).every(
              ([k, v]) => entry.item.value[k] === v,
            )
          ) {
            continue;
          }
          fromCache.push({ ...entry.item, value: { ...entry.item.value } });
        }
        return fromCache.slice(offset, offset + limit);
      },
      [] as SearchItem[],
    );
  }

  private handleListNamespaces(op: ListNamespacesOperation): string[][] {
    try {
      let namespaces = Array.from(this.knownNamespaces).map((raw) =>
        metaToNamespace(raw),
      );

      if (op.matchConditions && op.matchConditions.length > 0) {
        namespaces = namespaces.filter((ns) =>
          op.matchConditions!.every((condition) =>
            doesMatch(condition.matchType, condition.path, ns),
          ),
        );
      }

      if (op.maxDepth !== undefined) {
        namespaces = Array.from(
          new Set(
            namespaces.map((ns) => ns.slice(0, op.maxDepth).join("\0")),
          ),
        ).map((joined) => (joined.length ? joined.split("\0") : []));
      }

      namespaces.sort((a, b) => a.join("/").localeCompare(b.join("/")));
      return namespaces.slice(
        op.offset ?? 0,
        (op.offset ?? 0) + (op.limit ?? namespaces.length),
      );
    } catch (error) {
      try {
        this.onError?.(error, "listNamespaces");
      } catch {
        // ignore
      }
      return [];
    }
  }
}

/** Factory for {@link WolbargStore}. */
export function createWolbargStore(options: WolbargStoreOptions): WolbargStore {
  return new WolbargStore(options);
}
