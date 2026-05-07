import type { CompanyEntry, ConsensusEntry, TickerHit } from '@/shared/types';

const STOP_LIST = new Set<string>([
  'AI',
  'IT',
  'OR',
  'OK',
  'ALL',
  'ONE',
  'IS',
  'AT',
  'BE',
  'NO',
  'SO',
  'UP',
  'US',
  'USA',
  'CEO',
  'CFO',
  'CTO',
  'COO',
  'ML',
  'NFT',
  'IPO',
  'ETF',
  'GDP',
  'CPI',
  'TLDR',
  'IMO',
  'IMHO',
  'FYI',
  'WTF',
  'LOL',
  'POV',
  'TBH',
  'API',
]);

const TICKER_REGEX = /\$([A-Z]{1,5})\b|\b([A-Z]{2,5})\b/g;
const MAX_HITS_PER_POST = 2;

export type { TickerHit };

export function extractTickerHits(
  text: string,
  consensusIndex: Map<string, ConsensusEntry>,
  companyIndex: Map<string, CompanyEntry>,
): TickerHit[] {
  if (!text) return [];
  if (consensusIndex.size === 0 && companyIndex.size === 0) return [];
  const seen = new Map<string, TickerHit>();
  TICKER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const cashtag = match[1];
    const bare = match[2];
    const symbol = (cashtag ?? bare ?? '').toUpperCase();
    if (!symbol) continue;
    if (!cashtag && STOP_LIST.has(symbol)) continue;

    const consensusEntry = consensusIndex.get(symbol);
    const companyEntry = companyIndex.get(symbol);
    if (!consensusEntry && !companyEntry) continue;

    const tier: TickerHit['tier'] = consensusEntry ? 'consensus' : 'covered';
    const existing = seen.get(symbol);
    const viaCashtag = Boolean(cashtag) || Boolean(existing?.viaCashtag);
    const hit: TickerHit = {
      symbol,
      tier,
      viaCashtag,
    };
    if (consensusEntry) hit.consensusEntry = consensusEntry;
    if (companyEntry) hit.companyEntry = companyEntry;
    seen.set(symbol, hit);
  }
  return Array.from(seen.values()).slice(0, MAX_HITS_PER_POST);
}
