import {
  COMPANY_PAGE_PREFIX,
  CONSENSUS_ENDPOINT_DEFAULT,
  setConsensus,
} from '@/shared/consensus';
import { getSettings } from '@/shared/storage';
import type { ConsensusCache, ConsensusEntry } from '@/shared/types';

const ALARM_NAME = 'consensus-refresh';
const PERIOD_MINUTES = 1440;

interface RawEntry {
  ticker?: unknown;
  name?: unknown;
  thesis?: unknown;
  url?: unknown;
  updatedAt?: unknown;
}

interface RawPayload {
  updatedAt?: unknown;
  entries?: unknown;
}

export async function refreshConsensus(): Promise<ConsensusCache> {
  const settings = await getSettings();
  const endpoint = settings.consensusEndpoint?.trim() || CONSENSUS_ENDPOINT_DEFAULT;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!res.ok) {
    throw new Error(`Consensus fetch ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as RawPayload;
  const entries = normalizeEntries(json.entries);
  const cache: ConsensusCache = {
    entries,
    fetchedAt: Date.now(),
    source: endpoint,
  };
  await setConsensus(cache);
  return cache;
}

function normalizeEntries(raw: unknown): ConsensusEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsensusEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as RawEntry;
    const ticker = typeof r.ticker === 'string' ? r.ticker.trim().toUpperCase() : '';
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!ticker || !name) continue;
    if (!/^[A-Z]{1,5}$/.test(ticker)) continue;
    const url =
      typeof r.url === 'string' && r.url.trim()
        ? r.url.trim()
        : `${COMPANY_PAGE_PREFIX}${ticker}`;
    const entry: ConsensusEntry = { ticker, name, url };
    if (typeof r.thesis === 'string' && r.thesis.trim()) {
      entry.thesis = r.thesis.trim();
    }
    if (typeof r.updatedAt === 'string') {
      entry.updatedAt = r.updatedAt;
    }
    out.push(entry);
  }
  return out;
}

export function ensureConsensusAlarm(): void {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (existing) return;
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: PERIOD_MINUTES,
      delayInMinutes: PERIOD_MINUTES,
    });
  });
}

export function isConsensusAlarm(name: string): boolean {
  return name === ALARM_NAME;
}
