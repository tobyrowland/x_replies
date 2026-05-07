import type { AliasIndex } from '@/shared/agents';
import type {
  AgentHit,
  CompanyEntry,
  ConsensusEntry,
  Post,
  PostClass,
  TickerHit,
} from '@/shared/types';
import { extractAgentHits } from './agents';
import { extractTickerHits } from './tickers';

const GENERAL_AI_KEYWORDS = [
  'llm',
  'llms',
  'gpt',
  'chatgpt',
  'claude',
  'gemini',
  'opus',
  'sonnet',
  'haiku',
  'copilot',
  'agent',
  'agents',
  'ai model',
  'language model',
  'stock pick',
  'stock picks',
  'stock-picking',
  'portfolio',
  'finance',
  'investing',
  'investor',
  'equities',
  'equity',
  'stocks',
  'market',
];

export interface ClassifyContext {
  consensusIndex: Map<string, ConsensusEntry>;
  companyIndex: Map<string, CompanyEntry>;
  agentsIndex: AliasIndex;
}

export function classifyPost(post: Post, ctx: ClassifyContext): PostClass {
  const tickerHits = extractTickerHits(
    post.text,
    ctx.consensusIndex,
    ctx.companyIndex,
  );

  const consensusHit = pickConsensusHit(tickerHits);
  if (consensusHit?.consensusEntry) {
    return {
      kind: 'consensus-ticker',
      primary: consensusHit.consensusEntry,
      hits: tickerHits,
    };
  }

  const coveredHit = pickCoveredHit(tickerHits);
  if (coveredHit?.companyEntry) {
    return {
      kind: 'covered-ticker',
      primary: coveredHit.companyEntry,
      hits: tickerHits,
    };
  }

  const agentHits = extractAgentHits(post.text, ctx.agentsIndex);
  const primaryAgent = pickPrimaryAgent(agentHits);
  if (primaryAgent) {
    return {
      kind: 'agent',
      primary: primaryAgent.entry,
      hits: agentHits,
    };
  }

  if (looksLikeGeneralAi(post.text)) {
    return { kind: 'general-ai-finance' };
  }

  return { kind: 'none' };
}

function pickConsensusHit(hits: TickerHit[]): TickerHit | undefined {
  return hits.find((h) => h.tier === 'consensus');
}

function pickCoveredHit(hits: TickerHit[]): TickerHit | undefined {
  return hits.find((h) => h.tier === 'covered');
}

function pickPrimaryAgent(hits: AgentHit[]): AgentHit | undefined {
  if (hits.length === 0) return undefined;
  // Prefer the entry with the highest (lowest-numbered) rank when present.
  let best = hits[0]!;
  for (const h of hits) {
    if ((h.entry.rank ?? Infinity) < (best.entry.rank ?? Infinity)) best = h;
  }
  return best;
}

function looksLikeGeneralAi(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of GENERAL_AI_KEYWORDS) {
    if (lower.includes(kw)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}
