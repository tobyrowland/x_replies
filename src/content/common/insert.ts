export function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  selectAllInTarget(el);

  // Preferred path: paste event. ProseMirror / TipTap / Lexical / DraftJS
  // and Reddit's editor handle this natively and replace the selection
  // without double-firing.
  if (tryPaste(el, text)) return;

  // Fallback: execCommand insertText replaces the current selection.
  if (document.execCommand('insertText', false, text)) return;

  // Last resort.
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

function selectAllInTarget(el: HTMLElement): void {
  // execCommand('selectAll') acts on the focused element regardless of
  // whether it lives in light DOM or inside an open shadow root, which is
  // critical for Reddit's composer (contenteditable inside a shadow tree).
  if (document.execCommand('selectAll', false)) return;

  // Manual fallback for environments that don't honour the command.
  const root = el.getRootNode();
  const sel =
    root instanceof ShadowRoot &&
    'getSelection' in root &&
    typeof (root as unknown as { getSelection?: () => Selection | null })
      .getSelection === 'function'
      ? (root as unknown as { getSelection(): Selection | null }).getSelection()
      : window.getSelection();
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
    const notHandled = el.dispatchEvent(event);
    return !notHandled;
  } catch {
    return false;
  }
}
