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

export interface ConsensusEntry {
  ticker: string;
  name: string;
  url: string;
  thesis?: string;
  updatedAt?: string;
}

export interface ConsensusCache {
  entries: ConsensusEntry[];
  fetchedAt: number;
  source: string;
}

export interface Settings {
  apiKey: string;
  voiceSamples: string;
  systemPromptRules: string | null;
  enabledPlatforms: Record<PlatformName, boolean>;
  highlightThreshold: number;
  alphamoltPagesOverride: AlphamoltPage[] | null;
  consensusEndpoint: string | null;
}

export interface DraftReplyRequest {
  type: 'draftReply';
  post: Post;
  tickerEntry?: ConsensusEntry;
  candidateCount?: number;
}

export interface DraftReplyResponse {
  drafts: string[];
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

export interface RefreshConsensusRequest {
  type: 'refreshConsensus';
}

export interface RefreshConsensusResponse {
  cache: ConsensusCache;
}

export type BackgroundRequest =
  | DraftReplyRequest
  | ScorePostsRequest
  | RefreshConsensusRequest;
export type BackgroundResponse =
  | {
      ok: true;
      data: DraftReplyResponse | ScorePostsResponse | RefreshConsensusResponse;
    }
  | { ok: false; error: string };
