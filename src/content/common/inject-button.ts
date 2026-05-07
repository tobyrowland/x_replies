import type {
  AgentEntry,
  CompanyEntry,
  ConsensusEntry,
  PostClass,
} from '@/shared/types';
import type { AliasIndex } from '@/shared/agents';
import { classifyPost } from './classify';
import { requestDrafts } from './messaging';
import type { Platform, PostHandle } from './platform';

const PROCESSED_ATTR = 'data-alphamolt-buttons-mounted';

export interface InjectContext {
  consensusIndex: Map<string, ConsensusEntry>;
  companyIndex: Map<string, CompanyEntry>;
  agentsIndex: AliasIndex;
}

interface ButtonStyle {
  label: string;
  title: string;
  accent: string;
}

export function injectDraftButtons(
  platform: Platform,
  handles: PostHandle[],
  ctx: InjectContext,
): void {
  for (const handle of handles) {
    const anchor = platform.findReplyAnchor(handle);
    if (!anchor) continue;
    if (anchor.hasAttribute(PROCESSED_ATTR)) continue;
    anchor.setAttribute(PROCESSED_ATTR, '1');

    const slot = document.createElement('span');
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.marginLeft = '8px';
    slot.appendChild(buildIdleButton(platform, handle, ctx, slot));
    anchor.appendChild(slot);
  }
}

function buildIdleButton(
  platform: Platform,
  handle: PostHandle,
  ctx: InjectContext,
  slot: HTMLElement,
): HTMLElement {
  // Classify lazily so the label reflects the latest post text on click,
  // but also classify now to set the initial label.
  const post = platform.readPost(handle);
  const initialClass: PostClass = post
    ? classifyPost(post, {
        consensusIndex: ctx.consensusIndex,
        companyIndex: ctx.companyIndex,
        agentsIndex: ctx.agentsIndex,
      })
    : { kind: 'none' };
  const style = styleForClass(initialClass);
  const btn = pillButton(style);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    btn.textContent = 'Drafting…';
    try {
      const freshPost = platform.readPost(handle);
      if (!freshPost) throw new Error('Could not read post text.');
      const postClass = classifyPost(freshPost, {
        consensusIndex: ctx.consensusIndex,
        companyIndex: ctx.companyIndex,
        agentsIndex: ctx.agentsIndex,
      });
      const compose = await platform.openCompose(handle);
      if (!compose) throw new Error('Could not open compose box.');
      const { drafts } = await requestDrafts(freshPost, postClass);
      if (drafts.length === 0) throw new Error('No drafts returned.');
      platform.insertDraft(compose, drafts[0]!);
      slot.replaceChildren(
        buildCycler(platform, handle, ctx, postClass, drafts, compose, slot),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[alphamolt] draft failed', err);
      btn.textContent = '⚠ Failed';
      btn.title = msg;
      btn.dataset.busy = '0';
      window.setTimeout(() => {
        btn.textContent = style.label;
        btn.title = style.title;
      }, 4000);
    }
  });

  return btn;
}

function buildCycler(
  platform: Platform,
  handle: PostHandle,
  ctx: InjectContext,
  postClass: PostClass,
  drafts: string[],
  compose: HTMLElement,
  slot: HTMLElement,
): HTMLElement {
  const accent = styleForClass(postClass).accent;
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
    slot.replaceChildren(buildIdleButton(platform, handle, ctx, slot));
  });

  wrap.append(prev, counter, next, close);
  render();
  return wrap;
}

function styleForClass(postClass: PostClass): ButtonStyle {
  const ORANGE = 'rgba(255, 122, 0, 0.85)';
  const GREEN = 'rgba(34, 170, 85, 0.95)';
  const BLUE = 'rgba(46, 130, 230, 0.95)';

  switch (postClass.kind) {
    case 'consensus-ticker':
      return {
        label: `✎ Alphamolt — $${postClass.primary.ticker}`,
        title: `Draft 3 candidate replies; will reference ${postClass.primary.url}`,
        accent: GREEN,
      };
    case 'covered-ticker':
      return {
        label: `✎ Alphamolt — $${postClass.primary.ticker}`,
        title: `Draft 3 candidate replies for ${postClass.primary.ticker}`,
        accent: ORANGE,
      };
    case 'agent':
      return {
        label: `✎ Alphamolt — ${shortAgentLabel(postClass.primary)}`,
        title: `Draft 3 candidate replies; may reference ${postClass.primary.url}`,
        accent: BLUE,
      };
    case 'general-ai-finance':
    case 'none':
      return {
        label: '✎ Alphamolt',
        title: 'Draft 3 candidate replies in the voice of Alphamolt',
        accent: ORANGE,
      };
  }
}

function shortAgentLabel(entry: AgentEntry): string {
  // Strip a trailing "Pro" / version suffix to keep the button label tight.
  return entry.name.replace(/\s+(Pro|Mini|Flash|Turbo|Ultra|Plus)\b.*$/i, (m) => m.replace(/\s+/, ' ').trimEnd()).slice(0, 22);
}

function pillButton(opts: ButtonStyle): HTMLButtonElement {
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

