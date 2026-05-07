import {
  buildTickerIndex,
  EMPTY_CACHE,
  getConsensus,
  onConsensusChanged,
} from '@/shared/consensus';
import { getSettings, isPlatformEnabled, onSettingsChanged } from '@/shared/storage';
import type { ConsensusCache, ConsensusEntry, Settings } from '@/shared/types';
import { ensureHighlightStyle, scoreAndHighlight } from './highlighter';
import { injectDraftButtons } from './inject-button';
import { observeFeed } from './observer';
import type { Platform } from './platform';
import type { TickerHit } from './tickers';

export function runPlatform(platform: Platform): void {
  let settings: Settings | null = null;
  let tickerIndex: Map<string, ConsensusEntry> = new Map();
  let stopObserver: (() => void) | null = null;
  const hitsByPostId = new Map<string, TickerHit[]>();

  ensureHighlightStyle(`/* platform: ${platform.name} */ ${platform.highlightStyle}`);

  const tick = () => {
    if (!settings || !isPlatformEnabled(settings, platform.name)) return;
    const handles = platform.findPosts(document.body);
    if (handles.length === 0) return;
    if (settings.apiKey) {
      void scoreAndHighlight(
        platform,
        handles,
        settings.highlightThreshold,
        tickerIndex,
        hitsByPostId,
      );
    }
    injectDraftButtons(platform, handles, hitsByPostId);
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

  void Promise.all([getSettings(), getConsensus()]).then(
    ([s, cache]: [Settings, ConsensusCache]) => {
      settings = s;
      tickerIndex = buildTickerIndex(cache ?? EMPTY_CACHE);
      start();
    },
  );

  onSettingsChanged((s) => {
    settings = s;
    if (isPlatformEnabled(s, platform.name)) {
      if (!stopObserver) start();
      else tick();
    } else {
      stop();
    }
  });

  onConsensusChanged((cache) => {
    tickerIndex = buildTickerIndex(cache);
    tick();
  });
}
