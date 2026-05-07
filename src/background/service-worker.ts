import { draftReplies, scorePosts } from '@/llm/anthropic';
import { getSettings } from '@/shared/storage';
import { ALPHAMOLT_PAGES } from '@/data/alphamolt-pages';
import {
  ensureConsensusAlarm,
  isConsensusAlarm,
  refreshConsensus,
} from './consensus-fetcher';
import type {
  BackgroundRequest,
  BackgroundResponse,
  DraftReplyResponse,
  RefreshConsensusResponse,
  ScorePostsResponse,
} from '@/shared/types';

chrome.runtime.onInstalled.addListener((details) => {
  ensureConsensusAlarm();
  void refreshConsensus().catch((err) =>
    console.warn('[alphamolt] initial consensus fetch failed', err),
  );
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureConsensusAlarm();
  void refreshConsensus().catch((err) =>
    console.warn('[alphamolt] startup consensus fetch failed', err),
  );
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!isConsensusAlarm(alarm.name)) return;
  void refreshConsensus().catch((err) =>
    console.warn('[alphamolt] scheduled consensus fetch failed', err),
  );
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
): Promise<DraftReplyResponse | ScorePostsResponse | RefreshConsensusResponse> {
  const req = message as BackgroundRequest;

  if (req.type === 'refreshConsensus') {
    const cache = await refreshConsensus();
    return { cache };
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
      tickerEntry: req.tickerEntry,
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
