import type { ConsensusEntry } from '@/shared/types';

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

export interface TickerHit {
  entry: ConsensusEntry;
  viaCashtag: boolean;
}

export function extractTickerHits(
  text: string,
  index: Map<string, ConsensusEntry>,
): TickerHit[] {
  if (!text || index.size === 0) return [];
  const seen = new Map<string, TickerHit>();
  TICKER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const cashtag = match[1];
    const bare = match[2];
    const symbol = (cashtag ?? bare ?? '').toUpperCase();
    if (!symbol) continue;
    const entry = index.get(symbol);
    if (!entry) continue;
    if (!cashtag && STOP_LIST.has(symbol)) continue;
    const existing = seen.get(symbol);
    const viaCashtag = Boolean(cashtag) || Boolean(existing?.viaCashtag);
    seen.set(symbol, { entry, viaCashtag });
    if (seen.size >= MAX_HITS_PER_POST && !cashtag) {
      // Allow cashtag matches to upgrade an existing entry, but stop searching otherwise.
      break;
    }
  }
  return Array.from(seen.values()).slice(0, MAX_HITS_PER_POST);
}
