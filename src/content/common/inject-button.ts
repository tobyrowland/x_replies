import { requestDrafts } from './messaging';
import type { Platform, PostHandle } from './platform';
import type { TickerHit } from './tickers';

const PROCESSED_ATTR = 'data-alphamolt-buttons-mounted';

export function injectDraftButtons(
  platform: Platform,
  handles: PostHandle[],
  hitsByPostId: Map<string, TickerHit[]>,
): void {
  for (const handle of handles) {
    const anchor = platform.findReplyAnchor(handle);
    if (!anchor) continue;
    if (anchor.hasAttribute(PROCESSED_ATTR)) continue;
    anchor.setAttribute(PROCESSED_ATTR, '1');

    const hits = hitsByPostId.get(handle.id) ?? [];
    const tickerEntry = hits[0]?.entry;

    const slot = document.createElement('span');
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.marginLeft = '8px';
    slot.appendChild(buildIdleButton(platform, handle, tickerEntry, slot));
    anchor.appendChild(slot);
  }
}

function buildIdleButton(
  platform: Platform,
  handle: PostHandle,
  tickerEntry: { ticker: string; name: string; url: string; thesis?: string } | undefined,
  slot: HTMLElement,
): HTMLElement {
  const accent = tickerEntry ? 'rgba(34, 170, 85, 0.95)' : 'rgba(255, 122, 0, 0.85)';
  const label = tickerEntry
    ? `✎ Alphamolt — $${tickerEntry.ticker}`
    : '✎ Alphamolt';
  const title = tickerEntry
    ? `Draft 3 candidate replies; will reference ${tickerEntry.url}`
    : 'Draft 3 candidate replies in the voice of Alphamolt';

  const btn = pillButton({ label, title, accent });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    btn.textContent = 'Drafting…';
    try {
      const post = platform.readPost(handle);
      if (!post) throw new Error('Could not read post text.');
      const compose = await platform.openCompose(handle);
      if (!compose) throw new Error('Could not open compose box.');
      const { drafts } = await requestDrafts(post, tickerEntry);
      if (drafts.length === 0) throw new Error('No drafts returned.');
      platform.insertDraft(compose, drafts[0]!);
      slot.replaceChildren(
        buildCycler(platform, handle, tickerEntry, drafts, compose, slot),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[alphamolt] draft failed', err);
      btn.textContent = '⚠ Failed';
      btn.title = msg;
      btn.dataset.busy = '0';
      window.setTimeout(() => {
        btn.textContent = label;
        btn.title = title;
      }, 4000);
    }
  });

  return btn;
}

function buildCycler(
  platform: Platform,
  handle: PostHandle,
  tickerEntry: { ticker: string; name: string; url: string; thesis?: string } | undefined,
  drafts: string[],
  compose: HTMLElement,
  slot: HTMLElement,
): HTMLElement {
  const accent = tickerEntry ? 'rgba(34, 170, 85, 0.95)' : 'rgba(255, 122, 0, 0.85)';
  const wrap = document.createElement('span');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: `1px solid ${accent}`,
    borderRadius: '999px',
    padding: '2px 6px',
    fontSize: '12px',
    lineHeight: '1',
  } satisfies Partial<CSSStyleDeclaration>);

  let index = 0;

  const prev = arrowButton('‹', 'Previous draft');
  const next = arrowButton('›', 'Next draft');
  const counter = document.createElement('span');
  counter.style.minWidth = '28px';
  counter.style.textAlign = 'center';
  counter.style.opacity = '0.85';

  const close = arrowButton('✕', 'Dismiss drafts (keeps current text)');

  const render = () => {
    counter.textContent = `${index + 1}/${drafts.length}`;
    prev.disabled = index === 0;
    next.disabled = index === drafts.length - 1;
    prev.style.opacity = prev.disabled ? '0.35' : '0.85';
    next.style.opacity = next.disabled ? '0.35' : '0.85';
  };

  const swap = (delta: number) => {
    const target = Math.max(0, Math.min(drafts.length - 1, index + delta));
    if (target === index) return;
    index = target;
    platform.insertDraft(compose, drafts[index]!);
    render();
  };

  prev.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    swap(-1);
  });
  next.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    swap(1);
  });
  close.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.replaceChildren(buildIdleButton(platform, handle, tickerEntry, slot));
  });

  wrap.append(prev, counter, next, close);
  render();
  return wrap;
}

function pillButton(opts: { label: string; title: string; accent: string }): HTMLButtonElement {
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
  return btn;
}

function arrowButton(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.title = title;
  Object.assign(btn.style, {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0 4px',
    fontSize: '14px',
    lineHeight: '1',
    opacity: '0.85',
  } satisfies Partial<CSSStyleDeclaration>);
  return btn;
}
