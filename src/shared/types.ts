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

export interface CompanyEntry {
  ticker: string;
  name?: string;
  url: string;
}

export interface CompaniesCache {
  entries: CompanyEntry[];
  fetchedAt: number;
  source: string;
}

export interface AgentEntry {
  slug: string;
  name: string;
  url: string;
  aliases: string[];
  rank?: number;
  thesis?: string;
}

export interface AgentsCache {
  entries: AgentEntry[];
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
  companiesEndpoint: string | null;
  agentsEndpoint: string | null;
}

export interface TickerHit {
  symbol: string;
  tier: 'consensus' | 'covered' | 'unknown';
  consensusEntry?: ConsensusEntry;
  companyEntry?: CompanyEntry;
  viaCashtag: boolean;
}

export interface AgentHit {
  entry: AgentEntry;
  matchedAlias: string;
}

export type PostClass =
  | { kind: 'consensus-ticker'; primary: ConsensusEntry; hits: TickerHit[] }
  | { kind: 'covered-ticker'; primary: CompanyEntry; hits: TickerHit[] }
  | { kind: 'agent'; primary: AgentEntry; hits: AgentHit[] }
  | { kind: 'general-ai-finance' }
  | { kind: 'none' };

export interface DraftReplyRequest {
  type: 'draftReply';
  post: Post;
  postClass: PostClass;
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

export interface RefreshCompaniesRequest {
  type: 'refreshCompanies';
}
export interface RefreshCompaniesResponse {
  cache: CompaniesCache;
}

export interface RefreshAgentsRequest {
  type: 'refreshAgents';
}
export interface RefreshAgentsResponse {
  cache: AgentsCache;
}

export type BackgroundRequest =
  | DraftReplyRequest
  | ScorePostsRequest
  | RefreshConsensusRequest
  | RefreshCompaniesRequest
  | RefreshAgentsRequest;
export type BackgroundResponse =
  | {
      ok: true;
      data:
        | DraftReplyResponse
        | ScorePostsResponse
        | RefreshConsensusResponse
        | RefreshCompaniesResponse
        | RefreshAgentsResponse;
    }
  | { ok: false; error: string };
