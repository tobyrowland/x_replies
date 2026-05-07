import type { ConsensusEntry } from '@/shared/types';
import { requestDraft } from './messaging';
import type { Platform, PostHandle } from './platform';
import type { TickerHit } from './tickers';

const PROCESSED_ATTR = 'data-alphamolt-buttons-mounted';

export function injectDraftButtons(
  platform: Platform,
  handles: PostHandle[],
  hitsByPostId: Map<string, TickerHit[]>,
): void {
  for (const handle of handles) {
    if (handle.node.hasAttribute(PROCESSED_ATTR)) continue;
    const anchor = platform.findReplyAnchor(handle);
    if (!anchor) continue;
    handle.node.setAttribute(PROCESSED_ATTR, '1');

    const container = document.createElement('span');
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.marginLeft = '8px';

    container.appendChild(createGenericButton(platform, handle));

    const hits = hitsByPostId.get(handle.id) ?? [];
    for (const hit of hits) {
      container.appendChild(createTickerButton(platform, handle, hit.entry));
    }

    anchor.appendChild(container);
  }
}

function createGenericButton(platform: Platform, handle: PostHandle): HTMLElement {
  return createDraftButton({
    label: '✎ Alphamolt',
    title: 'Draft a reply in the voice of Alphamolt',
    accent: 'rgba(255, 122, 0, 0.85)',
    onClick: async () => {
      const post = platform.readPost(handle);
      if (!post) throw new Error('Could not read post text.');
      const compose = await platform.openCompose(handle);
      if (!compose) throw new Error('Could not open compose box.');
      const { draft } = await requestDraft(post);
      platform.insertDraft(compose, draft);
    },
  });
}

function createTickerButton(
  platform: Platform,
  handle: PostHandle,
  entry: ConsensusEntry,
): HTMLElement {
  return createDraftButton({
    label: `Ⓜ $${entry.ticker}`,
    title: `Draft a $${entry.ticker} reply that links to ${entry.url}`,
    accent: 'rgba(34, 170, 85, 0.95)',
    onClick: async () => {
      const post = platform.readPost(handle);
      if (!post) throw new Error('Could not read post text.');
      const compose = await platform.openCompose(handle);
      if (!compose) throw new Error('Could not open compose box.');
      const { draft } = await requestDraft(post, entry);
      platform.insertDraft(compose, draft);
    },
  });
}

interface DraftButtonOpts {
  label: string;
  title: string;
  accent: string;
  onClick: () => Promise<void>;
}

function createDraftButton(opts: DraftButtonOpts): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = opts.label;
  btn.title = opts.title;
  Object.assign(btn.style, {
    padding: '4px 8px',
    fontSize: '12px',
    lineHeight: '1',
    border: `1px solid ${opts.accent}`,
    borderRadius: '999px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    opacity: '0.85',
  } satisfies Partial<CSSStyleDeclaration>);

  btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
  btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.85'));

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    const original = btn.textContent;
    btn.textContent = 'Drafting…';
    try {
      await opts.onClick();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[alphamolt] draft failed', err);
      flashError(btn, msg);
    } finally {
      btn.textContent = original;
      btn.dataset.busy = '0';
    }
  });
  return btn;
}

function flashError(btn: HTMLElement, message: string): void {
  btn.title = message;
  btn.textContent = '⚠ Failed';
  window.setTimeout(() => {
    btn.title = 'Draft a reply in the voice of Alphamolt';
  }, 4000);
}
