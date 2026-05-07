import type {
  BackgroundResponse,
  ConsensusEntry,
  DraftReplyRequest,
  DraftReplyResponse,
  RefreshConsensusRequest,
  RefreshConsensusResponse,
  ScorePostsRequest,
  ScorePostsResponse,
} from '@/shared/types';

export async function requestDraft(
  post: DraftReplyRequest['post'],
  tickerEntry?: ConsensusEntry,
): Promise<DraftReplyResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'draftReply',
    post,
    tickerEntry,
  } satisfies DraftReplyRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as DraftReplyResponse;
}

export async function requestRefreshConsensus(): Promise<RefreshConsensusResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'refreshConsensus',
  } satisfies RefreshConsensusRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as RefreshConsensusResponse;
}

export async function requestScores(
  posts: ScorePostsRequest['posts'],
): Promise<ScorePostsResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'scorePosts',
    posts,
  } satisfies ScorePostsRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as ScorePostsResponse;
}
