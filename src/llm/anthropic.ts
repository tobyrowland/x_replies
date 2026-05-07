import type {
  AlphamoltPage,
  ConsensusEntry,
  Post,
  PostScore,
  ScorePostsRequest,
} from '@/shared/types';
import {
  buildDraftSystemPrompt,
  buildDraftUserMessage,
  buildScoreSystemPrompt,
  buildScoreUserMessage,
} from './prompts';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DRAFT_MODEL = 'claude-opus-4-7';
const SCORE_MODEL = 'claude-haiku-4-5-20251001';

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

async function callMessages(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const { apiKey, model, system, user, maxTokens } = params;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as MessagesResponse;
  const text = json.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('')
    .trim();
  if (!text) throw new Error('Anthropic returned empty content');
  return text;
}

export async function draftReply(params: {
  apiKey: string;
  voiceSamples: string;
  alphamoltPages: AlphamoltPage[];
  post: Post;
  tickerEntry?: ConsensusEntry;
}): Promise<string> {
  const system = buildDraftSystemPrompt({
    voiceSamples: params.voiceSamples,
    alphamoltPages: params.alphamoltPages,
    post: params.post,
    tickerEntry: params.tickerEntry,
  });
  const user = buildDraftUserMessage(params.post);
  return callMessages({
    apiKey: params.apiKey,
    model: DRAFT_MODEL,
    system,
    user,
    maxTokens: 1024,
  });
}

export async function scorePosts(params: {
  apiKey: string;
  voiceSamples: string;
  alphamoltPages: AlphamoltPage[];
  posts: ScorePostsRequest['posts'];
}): Promise<PostScore[]> {
  if (params.posts.length === 0) return [];
  const system = buildScoreSystemPrompt({
    voiceSamples: params.voiceSamples,
    alphamoltPages: params.alphamoltPages,
  });
  const user = buildScoreUserMessage(params.posts);
  const raw = await callMessages({
    apiKey: params.apiKey,
    model: SCORE_MODEL,
    system,
    user,
    maxTokens: 2048,
  });
  return parseScores(raw, params.posts.map((p) => p.id));
}

function parseScores(raw: string, knownIds: string[]): PostScore[] {
  const jsonText = extractJsonArray(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set(knownIds);
  const out: PostScore[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : null;
    const score = typeof e.score === 'number' ? e.score : null;
    const reason = typeof e.reason === 'string' ? e.reason : '';
    if (id && score !== null && allowed.has(id)) {
      out.push({ id, score: Math.max(0, Math.min(1, score)), reason });
    }
  }
  return out;
}

function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return candidate;
  return candidate.slice(start, end + 1);
}
