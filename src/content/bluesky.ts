import { runPlatform } from './common/runtime';
import type { Platform, PostHandle } from './common/platform';
import { waitFor } from './common/platform';
import { insertIntoContentEditable } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';

const POST_SELECTORS = [
  '[data-testid^="feedItem-by-"]',
  '[data-testid^="postThreadItem-by-"]',
  '[data-testid="postThreadView"] [role="article"]',
  'div[role="article"]',
];

const REPLY_BTN_SELECTORS = [
  '[data-testid="replyBtn"]',
  'button[aria-label="Reply" i]',
  'div[aria-label="Reply" i][role="button"]',
];

const COMPOSER_SELECTORS = [
  '[data-testid="composerTextInput"]',
  '[data-testid="composer"] [contenteditable="true"]',
  'div[role="dialog"] [contenteditable="true"][role="textbox"]',
  'div[role="dialog"] [contenteditable="true"]',
  '.ProseMirror[contenteditable="true"]',
];

let warnedNoPosts = false;

function querySome<T extends Element>(
  root: ParentNode,
  selectors: string[],
): T | null {
  for (const sel of selectors) {
    const el = root.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

function queryAllUnion<T extends Element>(
  root: ParentNode,
  selectors: string[],
): T[] {
  const seen = new Set<Element>();
  const out: T[] = [];
  for (const sel of selectors) {
    const list = root.querySelectorAll<T>(sel);
    for (const el of list) {
      if (seen.has(el)) continue;
      seen.add(el);
      out.push(el);
    }
  }
  return out;
}

const blueskyPlatform: Platform = {
  name: 'bluesky',
  highlightStyle: '',

  findPosts(root) {
    const nodes = queryAllUnion<HTMLElement>(root, POST_SELECTORS);
    if (nodes.length === 0 && !warnedNoPosts) {
      warnedNoPosts = true;
      console.warn(
        '[alphamolt] Bluesky: no posts matched any of the expected selectors. The UI may have changed; please report.',
      );
    }
    return nodes
      .filter((node) => node.querySelector('[data-testid="postText"], [data-word-wrap], div[dir="auto"]'))
      .map((node, i) => {
        let id = node.getAttribute(ID_ATTR);
        if (!id) {
          const link = node.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
          id = link?.href ?? `bsky-${Date.now()}-${i}`;
          node.setAttribute(ID_ATTR, id);
        }
        return { node, id };
      });
  },

  readPost({ node, id }) {
    const textNode =
      node.querySelector<HTMLElement>('[data-testid="postText"]') ??
      node.querySelector<HTMLElement>('[data-word-wrap]') ??
      node.querySelector<HTMLElement>('div[dir="auto"]');
    const text = (textNode?.innerText ?? '').trim();
    if (!text) return null;
    const testid = node.getAttribute('data-testid') ?? '';
    const author =
      testid.replace(/^feedItem-by-/, '').replace(/^postThreadItem-by-/, '') ||
      node.querySelector<HTMLAnchorElement>('a[href^="/profile/"]')
        ?.getAttribute('href')
        ?.replace(/^\/profile\//, '')
        .split('/')[0] ||
      'unknown';
    const link = node.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
    return {
      platform: 'bluesky',
      id,
      author,
      text,
      url: link?.href,
    } satisfies Post;
  },

  findReplyAnchor({ node }: PostHandle) {
    const replyBtn = querySome<HTMLElement>(node, REPLY_BTN_SELECTORS);
    if (!replyBtn) return null;
    return replyBtn.parentElement ?? replyBtn;
  },

  async openCompose({ node }: PostHandle) {
    const existing = querySome<HTMLElement>(document, COMPOSER_SELECTORS);
    if (existing) return existing;
    const replyBtn = querySome<HTMLElement>(node, REPLY_BTN_SELECTORS);
    replyBtn?.click();
    for (const sel of COMPOSER_SELECTORS) {
      const found = await waitFor<HTMLElement>(sel, { timeoutMs: 2000 });
      if (found) return found;
    }
    return null;
  },

  insertDraft(compose, text) {
    insertIntoContentEditable(compose, text);
  },
};

runPlatform(blueskyPlatform);
