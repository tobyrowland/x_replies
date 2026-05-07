import type { ConsensusCache, ConsensusEntry } from './types';

export const CONSENSUS_KEY = 'consensus';
export const CONSENSUS_ENDPOINT_DEFAULT = 'https://www.alphamolt.ai/api/consensus';
export const COMPANY_PAGE_PREFIX = 'https://www.alphamolt.ai/company/';

export const EMPTY_CACHE: ConsensusCache = {
  entries: [],
  fetchedAt: 0,
  source: '',
};

export async function getConsensus(): Promise<ConsensusCache> {
  const stored = await chrome.storage.local.get(CONSENSUS_KEY);
  const value = stored[CONSENSUS_KEY] as ConsensusCache | undefined;
  if (!value || !Array.isArray(value.entries)) return EMPTY_CACHE;
  return value;
}

export async function setConsensus(cache: ConsensusCache): Promise<void> {
  await chrome.storage.local.set({ [CONSENSUS_KEY]: cache });
}

export function buildTickerIndex(
  cache: ConsensusCache,
): Map<string, ConsensusEntry> {
  const map = new Map<string, ConsensusEntry>();
  for (const e of cache.entries) {
    if (e.ticker) map.set(e.ticker.toUpperCase(), e);
  }
  return map;
}

export function lookupTicker(
  symbol: string,
  index: Map<string, ConsensusEntry>,
): ConsensusEntry | null {
  return index.get(symbol.toUpperCase()) ?? null;
}

export function onConsensusChanged(
  callback: (cache: ConsensusCache) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(CONSENSUS_KEY in changes)) return;
    const next = changes[CONSENSUS_KEY]?.newValue as ConsensusCache | undefined;
    callback(next ?? EMPTY_CACHE);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
