import type { CompanyEntry, ConsensusEntry, TickerHit } from '@/shared/types';
import { requestScores } from './messaging';
import { COMPOSE_FLAG } from './markers';
import type { Platform, PostHandle } from './platform';
import { extractTickerHits } from './tickers';

const SCORED_ATTR = 'data-alphamolt-scored';
const HIGHLIGHT_CLASS = 'alphamolt-reply-worthy';
const CONSENSUS_CLASS = 'alphamolt-consensus-hit';
const STYLE_ID = 'alphamolt-highlight-style';
const BATCH_SIZE = 15;

export function ensureHighlightStyle(extra: string): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      box-shadow: inset 3px 0 0 0 rgba(255, 122, 0, 0.85);
      transition: box-shadow 250ms ease-out;
    }
    .${HIGHLIGHT_CLASS}::after {
      content: attr(data-alphamolt-reason);
      display: inline-block;
      margin-left: 6px;
      font-size: 11px;
      color: rgba(255, 122, 0, 0.85);
      font-style: italic;
    }
    .${CONSENSUS_CLASS} {
      box-shadow: inset 3px 0 0 0 rgba(34, 170, 85, 0.95);
    }
    .${CONSENSUS_CLASS}::after {
      content: attr(data-alphamolt-reason);
      display: inline-block;
      margin-left: 6px;
      font-size: 11px;
      color: rgba(34, 170, 85, 0.95);
      font-style: italic;
    }
    ${extra}
  `;
  document.head.appendChild(style);
}

export async function scoreAndHighlight(
  platform: Platform,
  handles: PostHandle[],
  threshold: number,
  consensusIndex: Map<string, ConsensusEntry>,
  companyIndex: Map<string, CompanyEntry>,
  hitsByPostId: Map<string, TickerHit[]>,
): Promise<void> {
  const fresh = handles.filter((h) => !h.node.hasAttribute(SCORED_ATTR));
  if (fresh.length === 0) return;

  // Resolve ticker hits per post; only consensus hits short-circuit scoring.
  const remaining: PostHandle[] = [];
  for (const handle of fresh) {
    const post = platform.readPost(handle);
    if (!post) {
      handle.node.setAttribute(SCORED_ATTR, '1');
      continue;
    }
    const hits = extractTickerHits(post.text, consensusIndex, companyIndex);
    if (hits.length > 0) hitsByPostId.set(post.id, hits);

    const consensusHits = hits.filter((h) => h.tier === 'consensus');
    if (consensusHits.length > 0) {
      if (!handle.node.hasAttribute(COMPOSE_FLAG)) {
        const label = consensusHits.map((h) => `$${h.symbol}`).join(', ');
        handle.node.classList.add(CONSENSUS_CLASS);
        handle.node.setAttribute(
          'data-alphamolt-reason',
          `${label} — Alphamolt consensus`,
        );
      }
      handle.node.setAttribute(SCORED_ATTR, '1');
    } else {
      remaining.push(handle);
    }
  }

  if (remaining.length === 0) return;

  const batch = remaining.slice(0, BATCH_SIZE);
  for (const h of batch) h.node.setAttribute(SCORED_ATTR, 'pending');

  const inputs = batch
    .map((h) => {
      const post = platform.readPost(h);
      return post
        ? { id: post.id, platform: post.platform, author: post.author, text: post.text }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (inputs.length === 0) return;

  try {
    const { scores } = await requestScores(inputs);
    const byId = new Map(scores.map((s) => [s.id, s]));
    for (const h of batch) {
      const s = byId.get(h.id);
      h.node.setAttribute(SCORED_ATTR, '1');
      if (s && s.score >= threshold) {
        h.node.classList.add(HIGHLIGHT_CLASS);
        if (s.reason) h.node.setAttribute('data-alphamolt-reason', s.reason);
      }
    }
  } catch (err) {
    console.warn('[alphamolt] scoring failed', err);
    for (const h of batch) h.node.removeAttribute(SCORED_ATTR);
  }
}
