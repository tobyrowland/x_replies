export function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const inserted = document.execCommand('insertText', false, text);
  if (inserted) return;
  el.dispatchEvent(
    new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: text,
      bubbles: true,
      cancelable: true,
    }),
  );
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
