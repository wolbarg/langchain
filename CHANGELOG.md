# @wolbarg/langchain

Changelog for the official LangChain JS / LangGraph JS adapter package.

## [1.0.0] — 2026-07-20

### Added

- `WolbargMemory` — `@langchain/core` `BaseMemory` adapter (recall on load, remember on save)
- `WolbargStore` — LangGraph `BaseStore` adapter for long-term memory (`put` / `get` / `delete` / `search`)
- `createWolbargMemory` / `createWolbargStore` factories
- Optional `createWolbargTools` for LangChain tool-calling agents
- Soft-fail recall/remember (never crash the chain); provenance `source: "wolbarg-langchain"`
