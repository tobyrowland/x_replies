export function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  selectAllContents(el);

  // Preferred path: paste event. ProseMirror / TipTap / Lexical / DraftJS
  // handle this natively and replace the selection without double-firing.
  if (tryPaste(el, text)) return;

  // Fallback: execCommand insertText.
  if (document.execCommand('insertText', false, text)) return;

  // Last resort: blunt textContent replacement plus an input event.
  el.textContent = text;
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
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

function selectAllContents(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
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
    // dispatchEvent returns false when a listener called preventDefault —
    // which is exactly what rich-text editors do when they handle paste.
    const notHandled = el.dispatchEvent(event);
    return !notHandled;
  } catch {
    return false;
  }
}
