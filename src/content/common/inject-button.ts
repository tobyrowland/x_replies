import type { Platform, PostHandle } from './platform';
import { requestDraft } from './messaging';

const BUTTON_ATTR = 'data-alphamolt-button';
const POST_PROCESSED_ATTR = 'data-alphamolt-button-mounted';

export function injectDraftButtons(
  platform: Platform,
  handles: PostHandle[],
): void {
  for (const handle of handles) {
    if (handle.node.hasAttribute(POST_PROCESSED_ATTR)) continue;
    const anchor = platform.findReplyAnchor(handle);
    if (!anchor) continue;
    handle.node.setAttribute(POST_PROCESSED_ATTR, '1');
    const button = createButton(platform, handle);
    anchor.appendChild(button);
  }
}

function createButton(platform: Platform, handle: PostHandle): HTMLElement {
  const btn = document.createElement('button');
  btn.setAttribute(BUTTON_ATTR, '1');
  btn.type = 'button';
  btn.textContent = '✎ Alphamolt';
  btn.title = 'Draft a reply in the voice of Alphamolt';
  Object.assign(btn.style, {
    marginLeft: '8px',
    padding: '4px 8px',
    fontSize: '12px',
    lineHeight: '1',
    border: '1px solid currentColor',
    borderRadius: '999px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    opacity: '0.75',
  } satisfies Partial<CSSStyleDeclaration>);

  btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
  btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.75'));

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    const original = btn.textContent;
    btn.textContent = 'Drafting…';
    try {
      const post = platform.readPost(handle);
      if (!post) throw new Error('Could not read post text.');
      const compose = await platform.openCompose(handle);
      if (!compose) throw new Error('Could not open compose box.');
      const { draft } = await requestDraft(post);
      platform.insertDraft(compose, draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[alphamolt] draft failed', err);
      flashError(btn, msg);
    } finally {
      btn.textContent = original;
      btn.dataset.busy = '0';
    }
  });

  return btn;
}

function flashError(btn: HTMLElement, message: string): void {
  btn.title = message;
  btn.textContent = '⚠ Failed';
  window.setTimeout(() => {
    btn.title = 'Draft a reply in the voice of Alphamolt';
  }, 4000);
}
