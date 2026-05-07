import { draftReply, scorePosts } from '@/llm/anthropic';
import { getSettings } from '@/shared/storage';
import { ALPHAMOLT_PAGES } from '@/data/alphamolt-pages';
import type {
  BackgroundRequest,
  BackgroundResponse,
  DraftReplyResponse,
  ScorePostsResponse,
} from '@/shared/types';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
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
): Promise<DraftReplyResponse | ScorePostsResponse> {
  const req = message as BackgroundRequest;
  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error('No Anthropic API key configured. Open extension options to set one.');
  }
  const pages = settings.alphamoltPagesOverride ?? ALPHAMOLT_PAGES;

  if (req.type === 'draftReply') {
    const draft = await draftReply({
      apiKey: settings.apiKey,
      voiceSamples: settings.voiceSamples,
      alphamoltPages: pages,
      post: req.post,
    });
    return { draft };
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
