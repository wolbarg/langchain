import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "node22",
  platform: "node",
  outDir: "dist",
  external: [
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/langgraph-checkpoint",
    "wolbarg",
  ],
});
