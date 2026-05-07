import {
  COMPANIES_ENDPOINT_DEFAULT,
  COMPANY_PAGE_PREFIX,
  setCompanies,
} from '@/shared/companies';
import { getSettings } from '@/shared/storage';
import type { CompaniesCache, CompanyEntry } from '@/shared/types';

const ALARM_NAME = 'companies-refresh';
const PERIOD_MINUTES = 1440;

interface RawEntry {
  ticker?: unknown;
  name?: unknown;
  url?: unknown;
}

interface RawPayload {
  entries?: unknown;
}

export async function refreshCompanies(): Promise<CompaniesCache> {
  const settings = await getSettings();
  const endpoint = settings.companiesEndpoint?.trim() || COMPANIES_ENDPOINT_DEFAULT;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!res.ok) {
    throw new Error(`Companies fetch ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as RawPayload;
  const entries = normalizeEntries(json.entries);
  const cache: CompaniesCache = {
    entries,
    fetchedAt: Date.now(),
    source: endpoint,
  };
  await setCompanies(cache);
  return cache;
}

function normalizeEntries(raw: unknown): CompanyEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CompanyEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as RawEntry;
    const ticker = typeof r.ticker === 'string' ? r.ticker.trim().toUpperCase() : '';
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) continue;
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    const url =
      typeof r.url === 'string' && r.url.trim()
        ? r.url.trim()
        : `${COMPANY_PAGE_PREFIX}${ticker}`;
    const entry: CompanyEntry = { ticker, url };
    if (typeof r.name === 'string' && r.name.trim()) entry.name = r.name.trim();
    out.push(entry);
  }
  return out;
}

export function ensureCompaniesAlarm(): void {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (existing) return;
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: PERIOD_MINUTES,
      delayInMinutes: PERIOD_MINUTES,
    });
  });
}

export function isCompaniesAlarm(name: string): boolean {
  return name === ALARM_NAME;
}
