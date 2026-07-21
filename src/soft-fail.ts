/**
 * Soft-fail helpers — never throw into the LangChain / LangGraph path for memory ops.
 */

import type { WolbargLangChainErrorPhase } from "./types.js";

export function notifyError(
  onError:
    | ((error: unknown, phase: WolbargLangChainErrorPhase) => void)
    | undefined,
  error: unknown,
  phase: WolbargLangChainErrorPhase,
): void {
  if (!onError) return;
  try {
    onError(error, phase);
  } catch {
    // Never let error hooks break the framework path.
  }
}

export async function softFail<T>(
  phase: WolbargLangChainErrorPhase,
  onError:
    | ((error: unknown, phase: WolbargLangChainErrorPhase) => void)
    | undefined,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    notifyError(onError, error, phase);
    return fallback;
  }
}
