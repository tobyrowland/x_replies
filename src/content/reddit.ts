import { runPlatform } from './common/runtime';
import type { Platform, PostHandle } from './common/platform';
import { insertIntoContentEditable, insertIntoTextarea } from './common/insert';
import type { Post } from '@/shared/types';

const ID_ATTR = 'data-alphamolt-id';
const COMPOSE_FLAG = 'data-alphamolt-r-compose';
const POST_REF_ATTR = 'data-alphamolt-r-post-ref';
const SUBMIT_LABELS = new Set(['Comment', 'Reply', 'Post', 'Save']);

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

// ---- New Reddit (Shreddit) -------------------------------------------------

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

function findShredditPosts(root: ParentNode): PostHandle[] {
  const handles: PostHandle[] = [];

  // Compose anchors first — these are where the button gets injected.
  const composerRows = findShredditComposerRows(root);
  for (const [i, row] of composerRows.entries()) {
    let id = row.getAttribute(ID_ATTR);
    if (!id) {
      id = `r-compose-${Date.now()}-${i}`;
      row.setAttribute(ID_ATTR, id);
    }
    if (!row.hasAttribute(COMPOSE_FLAG)) {
      row.setAttribute(COMPOSE_FLAG, '1');
      const post = findRelatedShredditPost(row);
      if (post) {
        const postId = ensureId(post, 'r', handles.length);
        row.setAttribute(POST_REF_ATTR, postId);
      }
    }
    handles.push({ node: row, id });
  }

  // Posts and comments — for the highlighter only (findShredditAnchor returns
  // null for these so no inline button is injected).
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

function findShredditComposerRows(root: ParentNode): HTMLElement[] {
  const rows = new Set<HTMLElement>();

  // Strategy A: explicit web-component selectors.
  const hosts = root.querySelectorAll<HTMLElement>(
    'shreddit-composer, comment-composer-host, [data-testid="comment-composer-host"]',
  );
  for (const host of hosts) {
    if (!isVisible(host)) continue;
    const row =
      host.querySelector<HTMLElement>(
        'faceplate-form-action-row, [data-testid="composer-actions"]',
      ) ?? findRowAroundSubmit(host);
    if (row && isVisible(row)) rows.add(row);
  }

  // Strategy B: behavioural — find any visible "Comment" / "Reply" / "Post"
  // button that has a sibling "Cancel" button. That row is the composer's
  // action row regardless of which web component wraps it.
  const buttons = root.querySelectorAll<HTMLElement>('button');
  for (const btn of buttons) {
    if (!isVisible(btn)) continue;
    const text = (btn.textContent ?? '').trim();
    if (!SUBMIT_LABELS.has(text)) continue;
    const row = btn.parentElement;
    if (!row) continue;
    const hasCancel = Array.from(row.querySelectorAll('button')).some(
      (b) => (b.textContent ?? '').trim() === 'Cancel',
    );
    if (hasCancel) rows.add(row);
  }

  return Array.from(rows);
}

function findRowAroundSubmit(scope: ParentNode): HTMLElement | null {
  const submit = scope.querySelector<HTMLElement>('button[type="submit"]');
  return submit?.parentElement ?? null;
}

function findRelatedShredditPost(row: HTMLElement): HTMLElement | null {
  // Reply-to-comment: composer is nested inside a shreddit-comment.
  const ancestorComment = row.closest<HTMLElement>('shreddit-comment');
  if (ancestorComment) return ancestorComment;

  // Reply-to-post: composer is a sibling/descendant somewhere after the post.
  let cursor: Element | null = row;
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

  // Fallback: first shreddit-post on the page (the OP on a post-detail page).
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
  return node.hasAttribute(COMPOSE_FLAG) ? node : null;
}

function findShredditCompose({ node }: PostHandle): HTMLElement | null {
  if (!node.hasAttribute(COMPOSE_FLAG)) return null;
  // The contenteditable lives somewhere up the tree from the action row.
  let parent: HTMLElement | null = node.parentElement;
  for (let i = 0; i < 8 && parent; i++, parent = parent.parentElement) {
    const ce = parent.querySelector<HTMLElement>('[contenteditable="true"]');
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
