import type { PlatformName, Post } from '@/shared/types';

export interface PostHandle {
  node: HTMLElement;
  id: string;
}

export interface Platform {
  readonly name: PlatformName;
  readonly highlightStyle: string;
  findPosts(root: ParentNode): PostHandle[];
  readPost(handle: PostHandle): Post | null;
  findReplyAnchor(handle: PostHandle): HTMLElement | null;
  openCompose(handle: PostHandle): Promise<HTMLElement | null>;
  insertDraft(compose: HTMLElement, text: string): void;
}

export function waitFor<T extends Element>(
  selector: string,
  options: { root?: ParentNode; timeoutMs?: number } = {},
): Promise<T | null> {
  const root = options.root ?? document;
  const timeoutMs = options.timeoutMs ?? 5000;
  const existing = root.querySelector<T>(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = root.querySelector<T>(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(root instanceof Document ? root.body : (root as Node), {
      childList: true,
      subtree: true,
    });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}
