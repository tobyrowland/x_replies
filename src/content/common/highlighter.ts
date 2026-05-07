import type { Platform, PostHandle } from './platform';
import { requestScores } from './messaging';

const SCORED_ATTR = 'data-alphamolt-scored';
const HIGHLIGHT_CLASS = 'alphamolt-reply-worthy';
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
    ${extra}
  `;
  document.head.appendChild(style);
}

export async function scoreAndHighlight(
  platform: Platform,
  handles: PostHandle[],
  threshold: number,
): Promise<void> {
  const fresh = handles.filter((h) => !h.node.hasAttribute(SCORED_ATTR));
  if (fresh.length === 0) return;

  const batch = fresh.slice(0, BATCH_SIZE);
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
