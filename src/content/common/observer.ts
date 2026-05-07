export function observeFeed(
  onMutation: () => void,
  options: { debounceMs?: number } = {},
): () => void {
  const debounceMs = options.debounceMs ?? 300;
  let timer: number | undefined;
  const trigger = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(onMutation, debounceMs);
  };

  trigger();

  const observer = new MutationObserver(trigger);
  observer.observe(document.body, { childList: true, subtree: true });

  // Re-scan on SPA navigation.
  let lastUrl = location.href;
  const navInterval = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      trigger();
    }
  }, 750);

  return () => {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    clearInterval(navInterval);
  };
}
