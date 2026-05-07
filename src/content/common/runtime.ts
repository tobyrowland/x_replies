import { getSettings, isPlatformEnabled, onSettingsChanged } from '@/shared/storage';
import type { Settings } from '@/shared/types';
import { ensureHighlightStyle, scoreAndHighlight } from './highlighter';
import { injectDraftButtons } from './inject-button';
import { observeFeed } from './observer';
import type { Platform } from './platform';

export function runPlatform(platform: Platform): void {
  let settings: Settings | null = null;
  let stopObserver: (() => void) | null = null;

  ensureHighlightStyle(`/* platform: ${platform.name} */ ${platform.highlightStyle}`);

  const tick = () => {
    if (!settings || !isPlatformEnabled(settings, platform.name)) return;
    const handles = platform.findPosts(document.body);
    if (handles.length === 0) return;
    injectDraftButtons(platform, handles);
    if (settings.apiKey) {
      void scoreAndHighlight(platform, handles, settings.highlightThreshold);
    }
  };

  const start = () => {
    if (stopObserver || !settings) return;
    if (!isPlatformEnabled(settings, platform.name)) return;
    stopObserver = observeFeed(tick, { debounceMs: 400 });
  };

  const stop = () => {
    stopObserver?.();
    stopObserver = null;
  };

  void getSettings().then((s) => {
    settings = s;
    start();
  });

  onSettingsChanged((s) => {
    settings = s;
    if (isPlatformEnabled(s, platform.name)) {
      if (!stopObserver) start();
      else tick();
    } else {
      stop();
    }
  });
}
