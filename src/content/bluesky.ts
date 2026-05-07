import { runPlatform } from './common/runtime';
import { COMPOSE_FLAG } from './common/markers';
import type { Platform, PostHandle } from './common/platform';
import { insertIntoContentEditable } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';
// COMPOSE_FLAG imported from common/markers

const POST_SELECTORS = [
  '[data-testid^="feedItem-by-"]',
  '[data-testid^="postThreadItem-by-"]',
  '[data-testid="postThreadView"] [role="article"]',
  'div[role="article"]',
];

const COMPOSER_SELECTORS = [
  '[data-testid="composerTextInput"]',
  '[data-testid="composer"] [contenteditable="true"]',
  'div[role="dialog"] [contenteditable="true"][role="textbox"]',
  'div[role="dialog"] [contenteditable="true"]',
  '.ProseMirror[contenteditable="true"]',
];

const POST_BUTTON_SELECTORS = [
  'button[aria-label="Post" i]',
  'button[aria-label="Reply" i]',
  '[data-testid="composerPublishBtn"]',
];

let warnedNoPosts = false;

function isVisible(el: Element | null): boolean {
  if (!el) return false;
  if (!(el instanceof HTMLElement)) return true;
  return el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
}

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
    for (const el of root.querySelectorAll<T>(sel)) {
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
    const handles: PostHandle[] = [];

    // Active composers (modal or inline). These are where the button goes.
    const composers = queryAllUnion<HTMLElement>(root, COMPOSER_SELECTORS);
    for (const composer of composers) {
      if (!isVisible(composer)) continue;
      const container =
        composer.closest<HTMLElement>('[role="dialog"]') ??
        composer.closest<HTMLElement>('form') ??
        composer.parentElement?.parentElement ??
        composer.parentElement ??
        composer;
      let id = container.getAttribute(ID_ATTR);
      if (!id) {
        id = `bsky-compose-${Date.now()}-${handles.length}`;
        container.setAttribute(ID_ATTR, id);
      }
      container.setAttribute(COMPOSE_FLAG, '1');
      handles.push({ node: container, id });
    }

    // Feed posts: tracked so the highlighter can score them, but the
    // button is not anchored here (findReplyAnchor returns null below).
    const feedNodes = queryAllUnion<HTMLElement>(root, POST_SELECTORS);
    if (feedNodes.length === 0 && composers.length === 0 && !warnedNoPosts) {
      warnedNoPosts = true;
      console.warn(
        '[alphamolt] Bluesky: no posts or composer matched any of the expected selectors. The UI may have changed; please report.',
      );
    }
    for (const [i, node] of feedNodes.entries()) {
      if (
        !node.querySelector(
          '[data-testid="postText"], [data-word-wrap], div[dir="auto"]',
        )
      ) {
        continue;
      }
      let id = node.getAttribute(ID_ATTR);
      if (!id) {
        const link = node.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
        id = link?.href ?? `bsky-feed-${Date.now()}-${i}`;
        node.setAttribute(ID_ATTR, id);
      }
      handles.push({ node, id });
    }

    return handles;
  },

  readPost({ node, id }) {
    if (node.hasAttribute(COMPOSE_FLAG)) {
      return readComposeContext(node, id);
    }
    return readFeedPost(node, id);
  },

  findReplyAnchor({ node }) {
    if (!node.hasAttribute(COMPOSE_FLAG)) return null;
    const postBtn = querySome<HTMLElement>(node, POST_BUTTON_SELECTORS);
    if (postBtn) return postBtn.parentElement ?? postBtn;
    const composer = querySome<HTMLElement>(node, COMPOSER_SELECTORS);
    return composer?.parentElement ?? composer;
  },

  async openCompose({ node }) {
    if (!node.hasAttribute(COMPOSE_FLAG)) return null;
    return querySome<HTMLElement>(node, COMPOSER_SELECTORS);
  },

  insertDraft(compose, text) {
    insertIntoContentEditable(compose, text);
  },
};

function readComposeContext(node: HTMLElement, id: string): Post | null {
  // The Bluesky composer modal usually shows the post being replied to,
  // either as a quoted preview or in an aria-labelled context block.
  const candidates = node.querySelectorAll<HTMLElement>(
    '[data-testid="postText"], [data-word-wrap], div[dir="auto"]',
  );
  let text = '';
  for (const el of candidates) {
    const t = (el.innerText ?? '').trim();
    if (t.length > text.length) text = t;
  }
  if (!text) return null;
  const link = node.querySelector<HTMLAnchorElement>('a[href^="/profile/"]');
  const author =
    link?.getAttribute('href')?.replace(/^\/profile\//, '').split('/')[0] ??
    'unknown';
  return { platform: 'bluesky', id, author, text } satisfies Post;
}

function readFeedPost(node: HTMLElement, id: string): Post | null {
  const textNode =
    node.querySelector<HTMLElement>('[data-testid="postText"]') ??
    node.querySelector<HTMLElement>('[data-word-wrap]') ??
    node.querySelector<HTMLElement>('div[dir="auto"]');
  const text = (textNode?.innerText ?? '').trim();
  if (!text) return null;
  const testid = node.getAttribute('data-testid') ?? '';
  const author =
    testid.replace(/^feedItem-by-/, '').replace(/^postThreadItem-by-/, '') ||
    node
      .querySelector<HTMLAnchorElement>('a[href^="/profile/"]')
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
}

runPlatform(blueskyPlatform);
