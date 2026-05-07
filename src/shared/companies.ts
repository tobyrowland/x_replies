import type { CompaniesCache, CompanyEntry } from './types';

export const COMPANIES_KEY = 'companies';
export const COMPANIES_ENDPOINT_DEFAULT = 'https://www.alphamolt.ai/api/companies';
export const COMPANY_PAGE_PREFIX = 'https://www.alphamolt.ai/company/';

export const EMPTY_COMPANIES_CACHE: CompaniesCache = {
  entries: [],
  fetchedAt: 0,
  source: '',
};

export async function getCompanies(): Promise<CompaniesCache> {
  const stored = await chrome.storage.local.get(COMPANIES_KEY);
  const value = stored[COMPANIES_KEY] as CompaniesCache | undefined;
  if (!value || !Array.isArray(value.entries)) return EMPTY_COMPANIES_CACHE;
  return value;
}

export async function setCompanies(cache: CompaniesCache): Promise<void> {
  await chrome.storage.local.set({ [COMPANIES_KEY]: cache });
}

export function buildCompanyIndex(
  cache: CompaniesCache,
): Map<string, CompanyEntry> {
  const map = new Map<string, CompanyEntry>();
  for (const e of cache.entries) {
    if (e.ticker) map.set(e.ticker.toUpperCase(), e);
  }
  return map;
}

export function onCompaniesChanged(
  callback: (cache: CompaniesCache) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(COMPANIES_KEY in changes)) return;
    const next = changes[COMPANIES_KEY]?.newValue as CompaniesCache | undefined;
    callback(next ?? EMPTY_COMPANIES_CACHE);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
