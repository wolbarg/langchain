import { describe, expect, it, vi } from "vitest";
import { WolbargStore, createWolbargStore } from "../src/store.js";
import { WOLBARG_LANGCHAIN_SOURCE } from "../src/types.js";
import { createMockMemory, fakeHit } from "./helpers/mock-memory.js";

describe("WolbargStore", () => {
  it("createWolbargStore returns WolbargStore", () => {
    const { memory } = createMockMemory();
    const store = createWolbargStore({
      memory: memory as never,
      agent: "assistant",
    });
    expect(store).toBeInstanceOf(WolbargStore);
  });

  it("put → get round-trip via cache", async () => {
    const { memory, calls } = createMockMemory();
    const store = new WolbargStore({
      memory: memory as never,
      agent: "assistant",
    });

    await store.put(["users", "u1"], "prefs", { text: "dark mode" });
    expect(calls.remembers).toHaveLength(1);
    expect(calls.remembers[0]?.content.text).toBe("dark mode");
    expect(calls.remembers[0]?.metadata).toMatchObject({
      source: WOLBARG_LANGCHAIN_SOURCE,
      storeKey: "prefs",
    });

    const item = await store.get(["users", "u1"], "prefs");
    expect(item).not.toBeNull();
    expect(item?.value).toEqual({ text: "dark mode" });
    expect(item?.key).toBe("prefs");
    expect(item?.namespace).toEqual(["users", "u1"]);
  });

  it("delete forgets by wolbarg id", async () => {
    const { memory, calls } = createMockMemory();
    const store = new WolbargStore({
      memory: memory as never,
      agent: "assistant",
    });

    await store.put(["docs"], "a", { text: "alpha" });
    await store.delete(["docs"], "a");
    expect(calls.forgets).toHaveLength(1);
    expect(calls.forgets[0]?.id).toBe("mem-1");
    expect(await store.get(["docs"], "a")).toBeNull();
  });

  it("search with query uses recall", async () => {
    const { memory, calls } = createMockMemory({
      hits: [
        fakeHit("Python tutorial", {
          id: "h1",
          metadata: {
            storeKey: "doc1",
            storeNamespace: JSON.stringify(["docs"]),
            storeValue: JSON.stringify({ text: "Python tutorial" }),
          },
          similarity: 0.95,
        }),
      ],
    });
    const store = new WolbargStore({
      memory: memory as never,
      agent: "assistant",
    });

    const results = await store.search(["docs"], {
      query: "python programming",
      limit: 5,
    });

    expect(calls.recalls).toHaveLength(1);
    expect(calls.recalls[0]?.query).toBe("python programming");
    expect(results).toHaveLength(1);
    expect(results[0]?.key).toBe("doc1");
    expect(results[0]?.score).toBe(0.95);
  });

  it("soft-fails put errors", async () => {
    const onError = vi.fn();
    const { memory } = createMockMemory({
      rememberError: new Error("put fail"),
    });
    const store = new WolbargStore({
      memory: memory as never,
      agent: "assistant",
      onError,
    });

    await expect(
      store.put(["ns"], "k", { text: "x" }),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "put");
  });

  it("batch put + get", async () => {
    const { memory } = createMockMemory();
    const store = new WolbargStore({
      memory: memory as never,
      agent: "assistant",
    });

    const results = await store.batch([
      {
        namespace: ["ns"],
        key: "k1",
        value: { text: "one" },
      },
      {
        namespace: ["ns"],
        key: "k1",
      },
    ]);

    expect(results[0]).toBeUndefined();
    expect(results[1]).toMatchObject({
      key: "k1",
      value: { text: "one" },
    });
  });
});
