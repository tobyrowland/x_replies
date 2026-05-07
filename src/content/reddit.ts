import { runPlatform } from './common/runtime';
import type { Platform, PostHandle } from './common/platform';
import { waitFor } from './common/platform';
import { insertIntoContentEditable, insertIntoTextarea } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';
const isOldReddit = location.host === 'old.reddit.com';

const redditPlatform: Platform = {
  name: 'reddit',
  highlightStyle: '',

  findPosts(root) {
    return isOldReddit ? findOldRedditPosts(root) : findShredditPosts(root);
  },

  readPost(handle) {
    return isOldReddit ? readOldRedditPost(handle) : readShredditPost(handle);
  },

  findReplyAnchor(handle) {
    return isOldReddit
      ? findOldRedditAnchor(handle)
      : findShredditAnchor(handle);
  },

  async openCompose(handle) {
    return isOldReddit ? openOldRedditCompose(handle) : openShredditCompose(handle);
  },

  insertDraft(compose, text) {
    if (compose instanceof HTMLTextAreaElement) {
      insertIntoTextarea(compose, text);
    } else {
      insertIntoContentEditable(compose, text);
    }
  },
};

// ---- New Reddit (Shreddit web components) ----------------------------------

function findShredditPosts(root: ParentNode): PostHandle[] {
  const selectors = [
    'shreddit-post',
    'shreddit-comment',
    'article[data-testid="post-container"]',
  ];
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(selectors.join(', ')),
  );
  return nodes.map((node, i) => {
    let id = node.getAttribute(ID_ATTR);
    if (!id) {
      id =
        node.getAttribute('id') ||
        node.getAttribute('thingid') ||
        node.getAttribute('post-id') ||
        node.getAttribute('comment-id') ||
        `r-${Date.now()}-${i}`;
      node.setAttribute(ID_ATTR, id);
    }
    return { node, id };
  });
}

function readShredditPost({ node, id }: PostHandle): Post | null {
  const author =
    node.getAttribute('author') ||
    node.querySelector<HTMLElement>('a[href^="/user/"]')?.innerText.trim() ||
    'unknown';
  const titleEl = node.querySelector<HTMLElement>(
    '[slot="title"], [data-testid="post-title"]',
  );
  const bodyEl = node.querySelector<HTMLElement>(
    '[slot="text-body"], [slot="comment"], [data-testid="comment"]',
  );
  const text = [titleEl?.innerText, bodyEl?.innerText]
    .filter(Boolean)
    .join('\n\n')
    .trim();
  if (!text) return null;
  return { platform: 'reddit', id, author, text } satisfies Post;
}

function findShredditAnchor({ node }: PostHandle): HTMLElement | null {
  // Reddit's reply control varies; pick the action bar near the bottom.
  const actionBar =
    node.querySelector<HTMLElement>('shreddit-comment-action-row') ||
    node.querySelector<HTMLElement>('shreddit-post-shadow [slot="actionBar"]') ||
    node.querySelector<HTMLElement>('[data-testid="post-comment-bar"]');
  return actionBar ?? node;
}

async function openShredditCompose({ node }: PostHandle): Promise<HTMLElement | null> {
  // Existing top-of-thread reply box.
  const existing = document.querySelector<HTMLElement>(
    'shreddit-composer [contenteditable="true"], textarea[name="text"]',
  );
  if (existing) return existing;
  const replyBtn = node.querySelector<HTMLElement>(
    'button[aria-label="Reply"], shreddit-comment-action-row button[name="reply"]',
  );
  replyBtn?.click();
  return waitFor<HTMLElement>(
    'shreddit-composer [contenteditable="true"], textarea[name="text"]',
    { timeoutMs: 6000 },
  );
}

// ---- Old Reddit ------------------------------------------------------------

function findOldRedditPosts(root: ParentNode): PostHandle[] {
  const things = Array.from(
    root.querySelectorAll<HTMLElement>(
      'div.thing.link, div.thing.comment',
    ),
  );
  return things.map((node, i) => {
    let id = node.getAttribute(ID_ATTR);
    if (!id) {
      id = node.getAttribute('data-fullname') || `r-old-${Date.now()}-${i}`;
      node.setAttribute(ID_ATTR, id);
    }
    return { node, id };
  });
}

function readOldRedditPost({ node, id }: PostHandle): Post | null {
  const author = node.getAttribute('data-author') || 'unknown';
  const title = node.querySelector<HTMLElement>('a.title')?.innerText.trim();
  const body = node.querySelector<HTMLElement>('.usertext-body .md')?.innerText.trim();
  const text = [title, body].filter(Boolean).join('\n\n').trim();
  if (!text) return null;
  return { platform: 'reddit', id, author, text } satisfies Post;
}

function findOldRedditAnchor({ node }: PostHandle): HTMLElement | null {
  return node.querySelector<HTMLElement>('ul.flat-list.buttons') ?? null;
}

async function openOldRedditCompose({ node }: PostHandle): Promise<HTMLElement | null> {
  const existing = node.querySelector<HTMLTextAreaElement>(
    'textarea[name="text"]',
  );
  if (existing) return existing;
  const replyLink = Array.from(
    node.querySelectorAll<HTMLAnchorElement>('ul.flat-list.buttons a'),
  ).find((a) => a.textContent?.trim().toLowerCase() === 'reply');
  replyLink?.click();
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = () => {
      const ta = node.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
      if (ta) return resolve(ta);
      if (++attempts > 30) return resolve(null);
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

runPlatform(redditPlatform);
