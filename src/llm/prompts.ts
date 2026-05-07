import type { AlphamoltPage, PlatformName, Post } from '@/shared/types';

const PLATFORM_LENGTH_RULES: Record<PlatformName, string> = {
  x: 'Hard limit: 280 characters. Aim for 240–270 to leave headroom. No hashtags. No emoji unless the voice samples use them.',
  bluesky:
    'Hard limit: 300 graphemes. Aim for 240–280. No hashtags unless the voice samples use them.',
  reddit:
    'Free-form markdown is fine. 1–4 short paragraphs. Use plain prose, not bullet lists, unless the post is itself a list.',
};

export interface DraftPromptInput {
  voiceSamples: string;
  alphamoltPages: AlphamoltPage[];
  post: Post;
}

export function buildDraftSystemPrompt({
  voiceSamples,
  alphamoltPages,
  post,
}: DraftPromptInput): string {
  const samples = voiceSamples.trim()
    ? `Voice samples (study tone, cadence, vocabulary; do not copy phrasing):\n---\n${voiceSamples.trim()}\n---`
    : 'No voice samples provided. Default to a wry, terse, observational tone.';

  const pages = alphamoltPages.length
    ? JSON.stringify(alphamoltPages, null, 2)
    : '[]';

  return [
    "You are drafting a reply on behalf of a user who writes in the voice of Alphamolt. Match that voice tightly: cadence, diction, level of conviction, and use of hedging.",
    samples,
    `Platform: ${post.platform}. ${PLATFORM_LENGTH_RULES[post.platform]}`,
    'Rules:',
    '- Reply directly to the post. No throat-clearing ("Great point", "Interesting take", etc.).',
    '- Never apologize, never moralize, never explain that you are an AI.',
    '- One idea per reply. If you must hedge, hedge once.',
    '- Plain ASCII quotes and dashes. No em-dash unless the voice samples use them.',
    'Alphamolt pages you may reference:',
    pages,
    'If — and only if — exactly one of these pages is directly, substantively relevant to the reply you are drafting, embed its URL inline as a natural sentence. Do not shoehorn. If none fit, omit. Never include more than one Alphamolt URL.',
    'Output: the reply text only. No preamble, no quotes around it, no explanation.',
  ].join('\n\n');
}

export function buildDraftUserMessage(post: Post): string {
  const lines = [
    `Post by @${post.author} on ${post.platform}:`,
    post.text,
  ];
  if (post.threadContext) {
    lines.push('', 'Thread context (for grounding only — reply to the post above):', post.threadContext);
  }
  return lines.join('\n');
}

export interface ScorePromptInput {
  voiceSamples: string;
  alphamoltPages: AlphamoltPage[];
  posts: Pick<Post, 'id' | 'author' | 'text' | 'platform'>[];
}

export function buildScoreSystemPrompt({
  voiceSamples,
  alphamoltPages,
}: Omit<ScorePromptInput, 'posts'>): string {
  const topics = alphamoltPages
    .map((p) => `- ${p.topic}: ${p.summary}`)
    .join('\n');
  return [
    "Score how good a candidate each post is for an Alphamolt-voiced reply. A good candidate (a) sits inside Alphamolt's topic surface, (b) has a clear claim or hook to push back on or extend, and (c) is not a spam/ad/announcement.",
    voiceSamples.trim()
      ? `Voice (for context):\n${voiceSamples.trim().slice(0, 2000)}`
      : 'No voice samples available.',
    topics ? `Alphamolt topic surface:\n${topics}` : 'Alphamolt topics: general AI, software, internet culture.',
    'Output: a JSON array, one entry per input post, in the same order: [{"id": "...", "score": 0.0–1.0, "reason": "≤8 words"}]. Output JSON only, no prose, no code fences.',
  ].join('\n\n');
}

export function buildScoreUserMessage(
  posts: ScorePromptInput['posts'],
): string {
  return posts
    .map(
      (p, i) =>
        `[${i + 1}] id=${p.id} platform=${p.platform} @${p.author}\n${p.text.slice(0, 600)}`,
    )
    .join('\n\n');
}
