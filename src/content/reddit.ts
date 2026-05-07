import { runPlatform } from './common/runtime';
import type { Platform, PostHandle } from './common/platform';
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
    return isOldReddit
      ? findOldRedditCompose(handle.node)
      : findShredditCompose(handle.node);
  },

  insertDraft(compose, text) {
    if (compose instanceof HTMLTextAreaElement) {
      insertIntoTextarea(compose, text);
    } else {
      insertIntoContentEditable(compose, text);
    }
  },
};

function isVisible(el: Element | null): boolean {
  if (!el) return false;
  if (!(el instanceof HTMLElement)) return true;
  return el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
}

// ---- New Reddit (Shreddit) -------------------------------------------------

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

function findShredditCompose(post: HTMLElement): HTMLElement | null {
  const composer = post.querySelector<HTMLElement>(
    'shreddit-composer, comment-composer-host, [data-testid="comment-composer-host"]',
  );
  if (composer && isVisible(composer)) {
    const ce = composer.querySelector<HTMLElement>('[contenteditable="true"]');
    return ce ?? composer;
  }
  const ce = post.querySelector<HTMLElement>('[contenteditable="true"]');
  return ce && isVisible(ce) ? ce : null;
}

function findShredditAnchor({ node }: PostHandle): HTMLElement | null {
  const composer = node.querySelector<HTMLElement>(
    'shreddit-composer, comment-composer-host, [data-testid="comment-composer-host"]',
  );
  if (composer && isVisible(composer)) {
    const buttonRow = composer.querySelector<HTMLElement>(
      'faceplate-form-action-row, [data-testid="composer-actions"]',
    );
    return buttonRow ?? composer.parentElement ?? composer;
  }
  const ce = node.querySelector<HTMLElement>('[contenteditable="true"]');
  if (ce && isVisible(ce)) {
    return ce.closest<HTMLElement>('shreddit-composer, form, div') ?? ce.parentElement;
  }
  return null;
}

// ---- Old Reddit ------------------------------------------------------------

function findOldRedditPosts(root: ParentNode): PostHandle[] {
  const things = Array.from(
    root.querySelectorAll<HTMLElement>('div.thing.link, div.thing.comment'),
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

function findOldRedditCompose(post: HTMLElement): HTMLTextAreaElement | null {
  const candidates = post.querySelectorAll<HTMLTextAreaElement>(
    '.usertext-edit textarea[name="text"]',
  );
  for (const ta of candidates) {
    if (isVisible(ta)) return ta;
  }
  return null;
}

function findOldRedditAnchor(handle: PostHandle): HTMLElement | null {
  const ta = findOldRedditCompose(handle.node);
  if (!ta) return null;
  const wrapper = ta.closest<HTMLElement>('.usertext-edit') ?? ta.parentElement;
  const buttons = wrapper?.querySelector<HTMLElement>('.usertext-buttons');
  return buttons ?? wrapper ?? ta.parentElement;
}

runPlatform(redditPlatform);
