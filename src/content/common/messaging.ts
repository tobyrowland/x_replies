import type {
  BackgroundResponse,
  DraftReplyRequest,
  DraftReplyResponse,
  PostClass,
  RefreshAgentsRequest,
  RefreshAgentsResponse,
  RefreshCompaniesRequest,
  RefreshCompaniesResponse,
  RefreshConsensusRequest,
  RefreshConsensusResponse,
  ScorePostsRequest,
  ScorePostsResponse,
} from '@/shared/types';

function ensureRuntime(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    throw new Error(
      'Extension was reloaded — refresh this page (F5) to reconnect.',
    );
  }
}

async function send<T>(payload: unknown): Promise<T> {
  ensureRuntime();
  let res: BackgroundResponse;
  try {
    res = (await chrome.runtime.sendMessage(payload)) as BackgroundResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Extension context invalidated|Receiving end does not exist/i.test(msg)) {
      throw new Error(
        'Extension was reloaded — refresh this page (F5) to reconnect.',
      );
    }
    throw err;
  }
  if (!res) throw new Error('No response from background service worker.');
  if (!res.ok) throw new Error(res.error);
  return res.data as T;
}

export function requestDrafts(
  post: DraftReplyRequest['post'],
  postClass: PostClass,
  candidateCount = 3,
): Promise<DraftReplyResponse> {
  return send<DraftReplyResponse>({
    type: 'draftReply',
    post,
    postClass,
    candidateCount,
  } satisfies DraftReplyRequest);
}

export function requestScores(
  posts: ScorePostsRequest['posts'],
): Promise<ScorePostsResponse> {
  return send<ScorePostsResponse>({
    type: 'scorePosts',
    posts,
  } satisfies ScorePostsRequest);
}

export function requestRefreshConsensus(): Promise<RefreshConsensusResponse> {
  return send<RefreshConsensusResponse>({
    type: 'refreshConsensus',
  } satisfies RefreshConsensusRequest);
}

export function requestRefreshCompanies(): Promise<RefreshCompaniesResponse> {
  return send<RefreshCompaniesResponse>({
    type: 'refreshCompanies',
  } satisfies RefreshCompaniesRequest);
}

export function requestRefreshAgents(): Promise<RefreshAgentsResponse> {
  return send<RefreshAgentsResponse>({
    type: 'refreshAgents',
  } satisfies RefreshAgentsRequest);
}
