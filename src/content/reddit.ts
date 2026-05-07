import { runPlatform } from './common/runtime';
import { COMPOSE_FLAG } from './common/markers';
import type { Platform, PostHandle } from './common/platform';
import { insertIntoContentEditable, insertIntoTextarea } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';
// COMPOSE_FLAG imported from common/markers
const POST_REF_ATTR = 'data-alphamolt-r-post-ref';
const WRAP_ATTR = 'data-alphamolt-r-wrap';

const isOldReddit = location.host === 'old.reddit.com';

const HOST_SELECTORS = [
  'comment-composer-host',
  'shreddit-composer',
  'comment-composer',
  'reddit-composer',
  'faceplate-textarea-input',
  '[data-testid="comment-composer-host"]',
  '[data-testid*="composer" i]',
];

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
    return isOldReddit ? findOldRedditAnchor(handle) : findShredditAnchor(handle);
  },

  async openCompose(handle) {
    return isOldReddit
      ? findOldRedditCompose(handle.node)
      : findShredditCompose(handle);
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

function ensureId(node: HTMLElement, prefix: string, i: number): string {
  let id = node.getAttribute(ID_ATTR);
  if (!id) {
    id =
      node.getAttribute('id') ||
      node.getAttribute('thingid') ||
      node.getAttribute('post-id') ||
      node.getAttribute('comment-id') ||
      `${prefix}-${Date.now()}-${i}`;
    node.setAttribute(ID_ATTR, id);
  }
  return id;
}

// ---- New Reddit (Shreddit) -------------------------------------------------

function findShredditPosts(root: ParentNode): PostHandle[] {
  const handles: PostHandle[] = [];

  const hosts = findShredditComposerHosts(root);

  for (const [i, host] of hosts.entries()) {
    let id = host.getAttribute(ID_ATTR);
    if (!id) {
      id = `r-compose-${Date.now()}-${i}`;
      host.setAttribute(ID_ATTR, id);
    }
    if (!host.hasAttribute(COMPOSE_FLAG)) {
      host.setAttribute(COMPOSE_FLAG, '1');
      const post = findRelatedShredditPost(host);
      if (post) {
        const postId = ensureId(post, 'r-post', i);
        host.setAttribute(POST_REF_ATTR, postId);
      }
    }
    handles.push({ node: host, id });
  }

  // Posts and comments — for the highlighter only.
  const things = Array.from(
    root.querySelectorAll<HTMLElement>(
      'shreddit-post, shreddit-comment, article[data-testid="post-container"]',
    ),
  );
  for (const [i, node] of things.entries()) {
    const id = ensureId(node, 'r', i);
    handles.push({ node, id });
  }

  return handles;
}

function findShredditComposerHosts(root: ParentNode): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];

  // Direct web-component selectors.
  for (const sel of HOST_SELECTORS) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      if (!isVisible(el)) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      out.push(el);
    }
  }

  // Visible contenteditable in light DOM — walk up to a stable host.
  const editables = root.querySelectorAll<HTMLElement>('[contenteditable="true"]');
  for (const ce of editables) {
    if (!isVisible(ce)) continue;
    const host =
      ce.closest<HTMLElement>(HOST_SELECTORS.join(',')) ??
      ce.closest<HTMLElement>('form, [role="form"]') ??
      ce.parentElement?.parentElement ??
      ce.parentElement;
    if (host && isVisible(host) && !seen.has(host)) {
      seen.add(host);
      out.push(host);
    }
  }

  return out;
}

function findRelatedShredditPost(host: HTMLElement): HTMLElement | null {
  const ancestorComment = host.closest<HTMLElement>('shreddit-comment');
  if (ancestorComment) return ancestorComment;

  let cursor: Element | null = host;
  while (cursor) {
    let sibling = cursor.previousElementSibling;
    while (sibling) {
      if (sibling.matches('shreddit-post')) return sibling as HTMLElement;
      const inside = sibling.querySelector<HTMLElement>('shreddit-post');
      if (inside) return inside;
      sibling = sibling.previousElementSibling;
    }
    cursor = cursor.parentElement;
  }

  return document.querySelector<HTMLElement>('shreddit-post');
}

function readShredditPost({ node, id }: PostHandle): Post | null {
  if (node.hasAttribute(COMPOSE_FLAG)) {
    const ref = node.getAttribute(POST_REF_ATTR);
    if (!ref) return null;
    const post = document.querySelector<HTMLElement>(
      `[${ID_ATTR}="${CSS.escape(ref)}"]`,
    );
    if (!post) return null;
    return readShredditPostBody(post, id);
  }
  return readShredditPostBody(node, id);
}

function readShredditPostBody(node: HTMLElement, id: string): Post | null {
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
  if (!node.hasAttribute(COMPOSE_FLAG)) return null;
  // The composer's internals may be in shadow DOM (Cancel/Comment buttons,
  // the contenteditable). We can't anchor there reliably. Instead, create
  // (or reuse) a small wrapper as the next sibling of the host in light DOM
  // and use that as the anchor — the button will appear immediately below
  // the composer.
  const next = node.nextElementSibling;
  if (next instanceof HTMLElement && next.getAttribute(WRAP_ATTR) === '1') {
    return next;
  }
  const wrap = document.createElement('div');
  wrap.setAttribute(WRAP_ATTR, '1');
  Object.assign(wrap.style, {
    margin: '4px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
  } satisfies Partial<CSSStyleDeclaration>);
  node.insertAdjacentElement('afterend', wrap);
  return wrap;
}

function findShredditCompose({ node }: PostHandle): HTMLElement | null {
  if (!node.hasAttribute(COMPOSE_FLAG)) return null;
  // Light DOM first.
  const lightCe = node.querySelector<HTMLElement>('[contenteditable="true"]');
  if (lightCe && isVisible(lightCe)) return lightCe;
  // Shadow root if open.
  if (node.shadowRoot) {
    const shadowCe = node.shadowRoot.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (shadowCe && isVisible(shadowCe)) return shadowCe;
  }
  // Pierce one level deeper into descendants' shadow roots.
  const descendants = node.querySelectorAll<HTMLElement>('*');
  for (const d of descendants) {
    if (!d.shadowRoot) continue;
    const ce = d.shadowRoot.querySelector<HTMLElement>('[contenteditable="true"]');
    if (ce && isVisible(ce)) return ce;
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
