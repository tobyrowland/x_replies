import { draftReplies, scorePosts } from '@/llm/anthropic';
import { getSettings } from '@/shared/storage';
import { ALPHAMOLT_PAGES } from '@/data/alphamolt-pages';
import {
  ensureConsensusAlarm,
  isConsensusAlarm,
  refreshConsensus,
} from './consensus-fetcher';
import {
  ensureCompaniesAlarm,
  isCompaniesAlarm,
  refreshCompanies,
} from './companies-fetcher';
import {
  ensureAgentsAlarm,
  isAgentsAlarm,
  refreshAgents,
} from './agents-fetcher';
import type {
  BackgroundRequest,
  BackgroundResponse,
  DraftReplyResponse,
  RefreshAgentsResponse,
  RefreshCompaniesResponse,
  RefreshConsensusResponse,
  ScorePostsResponse,
} from '@/shared/types';

function refreshAll(reason: string) {
  void refreshConsensus().catch((err) =>
    console.warn(`[alphamolt] ${reason} consensus fetch failed`, err),
  );
  void refreshCompanies().catch((err) =>
    console.warn(`[alphamolt] ${reason} companies fetch failed`, err),
  );
  void refreshAgents().catch((err) =>
    console.warn(`[alphamolt] ${reason} agents fetch failed`, err),
  );
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureConsensusAlarm();
  ensureCompaniesAlarm();
  ensureAgentsAlarm();
  refreshAll('initial');
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureConsensusAlarm();
  ensureCompaniesAlarm();
  ensureAgentsAlarm();
  refreshAll('startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (isConsensusAlarm(alarm.name)) {
    void refreshConsensus().catch((err) =>
      console.warn('[alphamolt] scheduled consensus fetch failed', err),
    );
  } else if (isCompaniesAlarm(alarm.name)) {
    void refreshCompanies().catch((err) =>
      console.warn('[alphamolt] scheduled companies fetch failed', err),
    );
  } else if (isAgentsAlarm(alarm.name)) {
    void refreshAgents().catch((err) =>
      console.warn('[alphamolt] scheduled agents fetch failed', err),
    );
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (r: BackgroundResponse) => void) => {
    handleMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err);
        console.error('[alphamolt] background error', err);
        sendResponse({ ok: false, error });
      });
    return true;
  },
);

async function handleMessage(
  message: unknown,
): Promise<
  | DraftReplyResponse
  | ScorePostsResponse
  | RefreshConsensusResponse
  | RefreshCompaniesResponse
  | RefreshAgentsResponse
> {
  const req = message as BackgroundRequest;

  if (req.type === 'refreshConsensus') {
    return { cache: await refreshConsensus() };
  }
  if (req.type === 'refreshCompanies') {
    return { cache: await refreshCompanies() };
  }
  if (req.type === 'refreshAgents') {
    return { cache: await refreshAgents() };
  }

  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error('No Anthropic API key configured. Open extension options to set one.');
  }
  const pages = settings.alphamoltPagesOverride ?? ALPHAMOLT_PAGES;

  if (req.type === 'draftReply') {
    const drafts = await draftReplies({
      apiKey: settings.apiKey,
      voiceSamples: settings.voiceSamples,
      alphamoltPages: pages,
      post: req.post,
      postClass: req.postClass,
      rules: settings.systemPromptRules ?? undefined,
      candidateCount: req.candidateCount,
    });
    return { drafts };
  }

  if (req.type === 'scorePosts') {
    const scores = await scorePosts({
      apiKey: settings.apiKey,
      voiceSamples: settings.voiceSamples,
      alphamoltPages: pages,
      posts: req.posts,
    });
    return { scores };
  }

  throw new Error(`Unknown message type: ${(req as { type?: string }).type}`);
}
