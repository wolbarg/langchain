import { describe, expect, it } from "vitest";
import { createWolbargTools } from "../src/tools.js";
import { WOLBARG_LANGCHAIN_SOURCE } from "../src/types.js";
import { createMockMemory, fakeHit } from "./helpers/mock-memory.js";

describe("createWolbargTools", () => {
  it("exposes recall and remember tools", async () => {
    const { memory, calls } = createMockMemory({
      hits: [fakeHit("User lives in Berlin")],
    });
    const tools = createWolbargTools({
      memory: memory as never,
      agent: "assistant",
      sessionId: "s1",
    });
    const recallTool = tools[0] as {
      name: string;
      invoke: (input: { query: string }) => Promise<unknown>;
    };
    const rememberTool = tools[1] as {
      name: string;
      invoke: (input: { content: string }) => Promise<unknown>;
    };

    expect(recallTool.name).toBe("wolbarg_recall");
    expect(rememberTool.name).toBe("wolbarg_remember");

    const recalled = await recallTool.invoke({ query: "where do I live?" });
    expect(String(recalled)).toContain("Berlin");
    expect(calls.recalls).toHaveLength(1);

    const remembered = await rememberTool.invoke({
      content: "User likes espresso",
    });
    expect(remembered).toBe("Memory stored.");
    expect(calls.remembers[0]?.metadata).toMatchObject({
      source: WOLBARG_LANGCHAIN_SOURCE,
      sessionId: "s1",
    });
  });
});
