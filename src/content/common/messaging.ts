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

export async function requestDrafts(
  post: DraftReplyRequest['post'],
  postClass: PostClass,
  candidateCount = 3,
): Promise<DraftReplyResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'draftReply',
    post,
    postClass,
    candidateCount,
  } satisfies DraftReplyRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as DraftReplyResponse;
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

export async function requestRefreshConsensus(): Promise<RefreshConsensusResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'refreshConsensus',
  } satisfies RefreshConsensusRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as RefreshConsensusResponse;
}

export async function requestRefreshCompanies(): Promise<RefreshCompaniesResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'refreshCompanies',
  } satisfies RefreshCompaniesRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as RefreshCompaniesResponse;
}

export async function requestRefreshAgents(): Promise<RefreshAgentsResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'refreshAgents',
  } satisfies RefreshAgentsRequest)) as BackgroundResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as RefreshAgentsResponse;
}
