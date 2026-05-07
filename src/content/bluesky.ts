import { runPlatform } from './common/runtime';
import type { Platform } from './common/platform';
import { waitFor } from './common/platform';
import { insertIntoContentEditable } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';

const blueskyPlatform: Platform = {
  name: 'bluesky',
  highlightStyle: '',

  findPosts(root) {
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]',
      ),
    );
    return nodes.map((node, i) => {
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
    const textNode = node.querySelector<HTMLElement>(
      '[data-testid="postText"]',
    );
    const text = (textNode?.innerText ?? node.innerText ?? '').trim();
    if (!text) return null;
    const testid = node.getAttribute('data-testid') ?? '';
    const author =
      testid.replace(/^feedItem-by-/, '').replace(/^postThreadItem-by-/, '') ||
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

  findReplyAnchor({ node }) {
    const replyBtn = node.querySelector<HTMLElement>('[data-testid="replyBtn"]');
    return replyBtn?.parentElement ?? null;
  },

  async openCompose({ node }) {
    const existing = document.querySelector<HTMLElement>(
      '[data-testid="composerTextInput"]',
    );
    if (existing) return existing;
    const replyBtn = node.querySelector<HTMLElement>('[data-testid="replyBtn"]');
    replyBtn?.click();
    return waitFor<HTMLElement>('[data-testid="composerTextInput"]', {
      timeoutMs: 6000,
    });
  },

  insertDraft(compose, text) {
    insertIntoContentEditable(compose, text);
  },
};

runPlatform(blueskyPlatform);
