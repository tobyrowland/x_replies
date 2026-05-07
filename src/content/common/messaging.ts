import type {
  BackgroundResponse,
  DraftReplyRequest,
  DraftReplyResponse,
  ScorePostsRequest,
  ScorePostsResponse,
} from '@/shared/types';

export async function requestDraft(
  post: DraftReplyRequest['post'],
): Promise<DraftReplyResponse> {
  const res = (await chrome.runtime.sendMessage({
    type: 'draftReply',
    post,
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
