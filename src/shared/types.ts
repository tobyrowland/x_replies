export type PlatformName = 'x' | 'bluesky' | 'reddit';

export interface Post {
  platform: PlatformName;
  id: string;
  author: string;
  text: string;
  threadContext?: string;
  url?: string;
}

export interface AlphamoltPage {
  url: string;
  title: string;
  topic: string;
  summary: string;
}

export interface Settings {
  apiKey: string;
  voiceSamples: string;
  enabledPlatforms: Record<PlatformName, boolean>;
  highlightThreshold: number;
  alphamoltPagesOverride: AlphamoltPage[] | null;
}

export interface DraftReplyRequest {
  type: 'draftReply';
  post: Post;
}

export interface DraftReplyResponse {
  draft: string;
}

export interface ScorePostsRequest {
  type: 'scorePosts';
  posts: Pick<Post, 'id' | 'platform' | 'text' | 'author'>[];
}

export interface PostScore {
  id: string;
  score: number;
  reason: string;
}

export interface ScorePostsResponse {
  scores: PostScore[];
}

export type BackgroundRequest = DraftReplyRequest | ScorePostsRequest;
export type BackgroundResponse =
  | { ok: true; data: DraftReplyResponse | ScorePostsResponse }
  | { ok: false; error: string };
