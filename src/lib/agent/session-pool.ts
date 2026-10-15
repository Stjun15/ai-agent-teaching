import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import {
  createSession,
  type AgentSessionHandle,
  type CreateSessionOptions,
} from "./session";

const pool = new Map<string, PoolEntry>();

type PoolEntry = {
  handle: AgentSessionHandle;
  unsubscribe: (() => void) | null;
  lastUsed: number;
  systemPrompt: string;
  toolNames: string;
};

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export async function getOrCreateHandle(
  sessionId: string,
  options: Omit<CreateSessionOptions, "onEvent" | "signal">,
  onEvent: (event: AgentSessionEvent) => void,
): Promise<AgentSessionHandle> {
  const toolDigest = [...(options.tools ?? [])].sort().join(",");
  const existing = pool.get(sessionId);

  if (
    existing &&
    existing.systemPrompt === options.systemPrompt &&
    existing.toolNames === toolDigest
  ) {
    existing.unsubscribe?.();
    existing.unsubscribe = existing.handle.subscribe(onEvent);
    existing.lastUsed = Date.now();
    return existing.handle;
  }

  if (existing) {
    existing.unsubscribe?.();
    existing.handle.dispose();
  }

  const handle = await createSession({
    ...options,
    onEvent: undefined,
    signal: undefined,
  });
  const unsubscribe = handle.subscribe(onEvent);

  pool.set(sessionId, {
    handle,
    unsubscribe,
    lastUsed: Date.now(),
    systemPrompt: options.systemPrompt,
    toolNames: toolDigest,
  });

  return handle;
}

export function evictSession(sessionId: string): void {
  const entry = pool.get(sessionId);
  if (!entry) return;
  entry.unsubscribe?.();
  entry.handle.dispose();
  pool.delete(sessionId);
}

export function poolSize(): number {
  return pool.size;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pool) {
    if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      entry.unsubscribe?.();
      entry.handle.dispose();
      pool.delete(id);
    }
  }
}, 60_000);

if (typeof process !== "undefined") {
  process.on("beforeExit", () => clearInterval(cleanupTimer));
}