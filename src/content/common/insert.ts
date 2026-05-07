export function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();

  // Try every selectAll approach we know — different editors honour
  // different signals. Doing all three is cheap and only one needs to land.
  dispatchSelectAllKey(el);
  try {
    document.execCommand('selectAll', false);
  } catch {
    // ignore
  }
  selectRangeManually(el);

  // Insertion strategies in priority order:
  // 1. Paste event with text/plain — handled cleanly by ProseMirror / TipTap.
  if (tryPaste(el, text)) return;
  // 2. beforeinput with insertReplacementText — what browsers fire for
  //    spell-check replacements; Lexical (Reddit) handles this natively.
  if (tryBeforeInputReplace(el, text)) return;
  // 3. execCommand insertText — replaces the current selection if any.
  try {
    if (document.execCommand('insertText', false, text)) return;
  } catch {
    // ignore
  }
  // 4. Brute-force: clear children, set text, dispatch input.
  el.textContent = text;
  el.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }),
  );
}

export function insertIntoTextarea(
  el: HTMLTextAreaElement | HTMLInputElement,
  text: string,
): void {
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchSelectAllKey(el: HTMLElement): void {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);
  const init: KeyboardEventInit = {
    key: 'a',
    code: 'KeyA',
    keyCode: 65,
    which: 65,
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

function selectRangeManually(el: HTMLElement): void {
  const root = el.getRootNode();
  let sel: Selection | null = null;
  if (root instanceof ShadowRoot && 'getSelection' in root) {
    const fn = (
      root as unknown as { getSelection?: () => Selection | null }
    ).getSelection;
    if (typeof fn === 'function') sel = fn.call(root);
  }
  if (!sel) sel = window.getSelection();
  if (!sel) return;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore
  }
}

function tryPaste(el: HTMLElement, text: string): boolean {
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const event = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    const notHandled = el.dispatchEvent(event);
    return !notHandled;
  } catch {
    return false;
  }
}

function tryBeforeInputReplace(el: HTMLElement, text: string): boolean {
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const ev = new InputEvent('beforeinput', {
      inputType: 'insertReplacementText',
      data: text,
      bubbles: true,
      cancelable: true,
    });
    // Some browsers don't honour clipboardData/dataTransfer in the constructor
    // dictionary; expose it via property override so editor code that reads
    // ev.dataTransfer still gets the payload.
    try {
      Object.defineProperty(ev, 'dataTransfer', { get: () => dt });
    } catch {
      // not critical
    }
    const notHandled = el.dispatchEvent(ev);
    return !notHandled;
  } catch {
    return false;
  }
}
