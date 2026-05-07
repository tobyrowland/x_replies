import { runPlatform } from './common/runtime';
import type { Platform } from './common/platform';
import { waitFor } from './common/platform';
import { insertIntoContentEditable } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';

const xPlatform: Platform = {
  name: 'x',
  highlightStyle: '',

  findPosts(root) {
    const articles = Array.from(
      root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'),
    );
    return articles.map((node, i) => {
      let id = node.getAttribute(ID_ATTR);
      if (!id) {
        const link = node.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
        id = link?.href.match(/status\/(\d+)/)?.[1] ?? `x-${Date.now()}-${i}`;
        node.setAttribute(ID_ATTR, id);
      }
      return { node, id };
    });
  },

  readPost({ node, id }) {
    const textNode = node.querySelector<HTMLElement>('[data-testid="tweetText"]');
    const text = textNode?.innerText.trim() ?? '';
    if (!text) return null;
    const handleNode = node.querySelector<HTMLAnchorElement>(
      'div[data-testid="User-Name"] a[href^="/"]',
    );
    const author = handleNode?.getAttribute('href')?.replace(/^\//, '') ?? 'unknown';
    const link = node.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
    const url = link?.href;
    return {
      platform: 'x',
      id,
      author,
      text,
      url,
    } satisfies Post;
  },

  findReplyAnchor({ node }) {
    const replyBtn = node.querySelector<HTMLElement>('button[data-testid="reply"]');
    if (!replyBtn) return null;
    return replyBtn.parentElement?.parentElement ?? replyBtn.parentElement ?? null;
  },

  async openCompose({ node }) {
    const existing = document.querySelector<HTMLElement>(
      '[data-testid="tweetTextarea_0"]',
    );
    if (existing) return existing;
    const replyBtn = node.querySelector<HTMLElement>('button[data-testid="reply"]');
    replyBtn?.click();
    return waitFor<HTMLElement>('[data-testid="tweetTextarea_0"]', {
      timeoutMs: 6000,
    });
  },

  insertDraft(compose, text) {
    insertIntoContentEditable(compose, text);
  },
};

runPlatform(xPlatform);
