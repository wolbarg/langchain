import { describe, expect, it, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { WolbargMemory, createWolbargMemory } from "../src/memory.js";
import { WOLBARG_LANGCHAIN_SOURCE } from "../src/types.js";
import { createMockMemory, fakeHit } from "./helpers/mock-memory.js";

describe("WolbargMemory", () => {
  it("createWolbargMemory returns WolbargMemory", () => {
    const { memory } = createMockMemory();
    const m = createWolbargMemory({
      memory: memory as never,
      agent: "assistant",
    });
    expect(m).toBeInstanceOf(WolbargMemory);
    expect(m.memoryKeys).toEqual(["history"]);
  });

  it("loadMemoryVariables recalls and formats string history", async () => {
    const { memory, calls } = createMockMemory({
      hits: [fakeHit("User prefers dark mode")],
    });
    const m = new WolbargMemory({
      memory: memory as never,
      agent: "assistant",
      topK: 3,
    });

    const vars = await m.loadMemoryVariables({ input: "theme preference?" });
    expect(calls.recalls).toHaveLength(1);
    expect(calls.recalls[0]?.query).toBe("theme preference?");
    expect(calls.recalls[0]?.topK).toBe(3);
    expect(String(vars.history)).toContain("User prefers dark mode");
  });

  it("loadMemoryVariables returns messages when returnMessages is true", async () => {
    const { memory } = createMockMemory({
      hits: [fakeHit("likes typescript")],
    });
    const m = new WolbargMemory({
      memory: memory as never,
      agent: "assistant",
      returnMessages: true,
    });

    const vars = await m.loadMemoryVariables({ input: "languages?" });
    expect(Array.isArray(vars.history)).toBe(true);
    expect(vars.history[0]).toBeInstanceOf(HumanMessage);
    expect((vars.history[0] as HumanMessage).content).toBe("likes typescript");
  });

  it("soft-fails recall errors to empty history", async () => {
    const onError = vi.fn();
    const { memory } = createMockMemory({
      recallError: new Error("boom"),
    });
    const m = new WolbargMemory({
      memory: memory as never,
      agent: "assistant",
      onError,
    });

    const vars = await m.loadMemoryVariables({ input: "hello" });
    expect(vars.history).toBe("");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "recall");
  });

  it("saveContext remembers user+assistant via rememberFromMessages", async () => {
    const { memory, calls } = createMockMemory();
    const m = new WolbargMemory({
      memory: memory as never,
      agent: "assistant",
      sessionId: "s1",
    });

    await m.saveContext(
      { input: "I like dark mode" },
      { output: "Got it." },
    );

    expect(calls.rememberFromMessages).toHaveLength(1);
    const call = calls.rememberFromMessages[0]!;
    expect(call.messages).toEqual([
      { role: "user", content: "I like dark mode" },
      { role: "assistant", content: "Got it." },
    ]);
    expect(call.options).toMatchObject({
      agent: "assistant",
      metadata: expect.objectContaining({
        source: WOLBARG_LANGCHAIN_SOURCE,
        sessionId: "s1",
      }),
    });
  });

  it("soft-fails remember errors", async () => {
    const onError = vi.fn();
    const { memory } = createMockMemory({
      rememberError: new Error("write fail"),
    });
    const m = new WolbargMemory({
      memory: memory as never,
      agent: "assistant",
      onError,
    });

    await expect(
      m.saveContext({ input: "hi" }, { output: "hello" }),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "remember");
  });

  it("requires memory and agent", () => {
    expect(
      () => new WolbargMemory({ memory: null as never, agent: "" }),
    ).toThrow(/memory is required|agent must be/);
  });
});
