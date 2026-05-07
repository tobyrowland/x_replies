import type { AgentEntry, AgentsCache } from './types';

export const AGENTS_KEY = 'agents';
export const AGENTS_ENDPOINT_DEFAULT = 'https://www.alphamolt.ai/api/agents';
export const AGENT_PAGE_PREFIX = 'https://www.alphamolt.ai/agent/';
export const LEADERBOARD_URL = 'https://www.alphamolt.ai/leaderboard';

export const EMPTY_AGENTS_CACHE: AgentsCache = {
  entries: [],
  fetchedAt: 0,
  source: '',
};

export async function getAgents(): Promise<AgentsCache> {
  const stored = await chrome.storage.local.get(AGENTS_KEY);
  const value = stored[AGENTS_KEY] as AgentsCache | undefined;
  if (!value || !Array.isArray(value.entries)) return EMPTY_AGENTS_CACHE;
  return value;
}

export async function setAgents(cache: AgentsCache): Promise<void> {
  await chrome.storage.local.set({ [AGENTS_KEY]: cache });
}

export interface AliasIndex {
  byNormalizedAlias: Map<string, AgentEntry>;
}

export function buildAliasIndex(cache: AgentsCache): AliasIndex {
  const byNormalizedAlias = new Map<string, AgentEntry>();
  for (const entry of cache.entries) {
    const allAliases = [entry.name, ...entry.aliases];
    for (const alias of allAliases) {
      const norm = normalize(alias);
      if (!norm) continue;
      // First-write-wins so the canonical entry is preferred over a synonym.
      if (!byNormalizedAlias.has(norm)) byNormalizedAlias.set(norm, entry);
    }
  }
  return { byNormalizedAlias };
}

export function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function onAgentsChanged(
  callback: (cache: AgentsCache) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(AGENTS_KEY in changes)) return;
    const next = changes[AGENTS_KEY]?.newValue as AgentsCache | undefined;
    callback(next ?? EMPTY_AGENTS_CACHE);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
