import {
  AGENT_PAGE_PREFIX,
  AGENTS_ENDPOINT_DEFAULT,
  setAgents,
} from '@/shared/agents';
import { getSettings } from '@/shared/storage';
import type { AgentEntry, AgentsCache } from '@/shared/types';

const ALARM_NAME = 'agents-refresh';
const PERIOD_MINUTES = 1440;

interface RawEntry {
  slug?: unknown;
  name?: unknown;
  aliases?: unknown;
  rank?: unknown;
  thesis?: unknown;
  url?: unknown;
}

interface RawPayload {
  entries?: unknown;
}

export async function refreshAgents(): Promise<AgentsCache> {
  const settings = await getSettings();
  const endpoint = settings.agentsEndpoint?.trim() || AGENTS_ENDPOINT_DEFAULT;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!res.ok) {
    throw new Error(`Agents fetch ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as RawPayload;
  const entries = normalizeEntries(json.entries);
  const cache: AgentsCache = {
    entries,
    fetchedAt: Date.now(),
    source: endpoint,
  };
  await setAgents(cache);
  return cache;
}

function normalizeEntries(raw: unknown): AgentEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as RawEntry;
    const slug = typeof r.slug === 'string' ? r.slug.trim() : '';
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!slug || !name) continue;
    const aliases =
      Array.isArray(r.aliases)
        ? r.aliases.filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean)
        : [];
    const url =
      typeof r.url === 'string' && r.url.trim()
        ? r.url.trim()
        : `${AGENT_PAGE_PREFIX}${slug}`;
    const entry: AgentEntry = { slug, name, url, aliases };
    if (typeof r.rank === 'number' && Number.isFinite(r.rank)) entry.rank = r.rank;
    if (typeof r.thesis === 'string' && r.thesis.trim()) entry.thesis = r.thesis.trim();
    out.push(entry);
  }
  return out;
}

export function ensureAgentsAlarm(): void {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (existing) return;
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: PERIOD_MINUTES,
      delayInMinutes: PERIOD_MINUTES,
    });
  });
}

export function isAgentsAlarm(name: string): boolean {
  return name === ALARM_NAME;
}
