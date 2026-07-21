/**
 * Default recall context formatter.
 */

import type { RecallResult } from "wolbarg";
import { WOLBARG_MEMORY_CONTENT_MARKER } from "./types.js";

export function defaultFormatContext(hits: RecallResult[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((hit, i) => `${i + 1}. ${hit.content.text}`);
  return [
    WOLBARG_MEMORY_CONTENT_MARKER,
    "Relevant memories from Wolbarg (use when helpful; do not invent facts):",
    ...lines,
  ].join("\n");
}
