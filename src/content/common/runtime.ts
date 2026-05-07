import {
  buildAliasIndex,
  EMPTY_AGENTS_CACHE,
  getAgents,
  onAgentsChanged,
  type AliasIndex,
} from '@/shared/agents';
import {
  buildCompanyIndex,
  EMPTY_COMPANIES_CACHE,
  getCompanies,
  onCompaniesChanged,
} from '@/shared/companies';
import {
  buildTickerIndex,
  EMPTY_CACHE,
  getConsensus,
  onConsensusChanged,
} from '@/shared/consensus';
import { getSettings, isPlatformEnabled, onSettingsChanged } from '@/shared/storage';
import type {
  AgentsCache,
  CompaniesCache,
  CompanyEntry,
  ConsensusCache,
  ConsensusEntry,
  Settings,
  TickerHit,
} from '@/shared/types';
import { ensureHighlightStyle, scoreAndHighlight } from './highlighter';
import { injectDraftButtons } from './inject-button';
import { observeFeed } from './observer';
import type { Platform } from './platform';

export function runPlatform(platform: Platform): void {
  let settings: Settings | null = null;
  let consensusIndex: Map<string, ConsensusEntry> = new Map();
  let companyIndex: Map<string, CompanyEntry> = new Map();
  let agentsIndex: AliasIndex = { byNormalizedAlias: new Map() };
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
        consensusIndex,
        companyIndex,
        hitsByPostId,
      );
    }
    injectDraftButtons(platform, handles, {
      consensusIndex,
      companyIndex,
      agentsIndex,
    });
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

  void Promise.all([
    getSettings(),
    getConsensus(),
    getCompanies(),
    getAgents(),
  ]).then(
    ([s, consensus, companies, agents]: [
      Settings,
      ConsensusCache,
      CompaniesCache,
      AgentsCache,
    ]) => {
      settings = s;
      consensusIndex = buildTickerIndex(consensus ?? EMPTY_CACHE);
      companyIndex = buildCompanyIndex(companies ?? EMPTY_COMPANIES_CACHE);
      agentsIndex = buildAliasIndex(agents ?? EMPTY_AGENTS_CACHE);
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
    consensusIndex = buildTickerIndex(cache);
    tick();
  });
  onCompaniesChanged((cache) => {
    companyIndex = buildCompanyIndex(cache);
    tick();
  });
  onAgentsChanged((cache) => {
    agentsIndex = buildAliasIndex(cache);
    tick();
  });
}
