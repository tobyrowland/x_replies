import { LEADERBOARD_URL } from '@/shared/agents';
import { COMPANY_PAGE_PREFIX } from '@/shared/consensus';
import type {
  AgentEntry,
  AlphamoltPage,
  CompanyEntry,
  ConsensusEntry,
  PlatformName,
  Post,
  PostClass,
} from '@/shared/types';

const PLATFORM_LENGTH_RULES: Record<PlatformName, string> = {
  x: 'Hard ceiling: 280 characters. Shorter is better.',
  bluesky: 'Hard ceiling: 300 graphemes. Shorter is better.',
  reddit:
    '1–3 sentences unless the post is itself a long-form question. Plain prose, not bullet lists.',
};

export const DEFAULT_RULES = [
  'Be punchy.',
  'Be brief — be as brief as possible; brevity sounds human.',
  "Be casual; don't capitalise; minimal punctuation.",
  'No hashtags. No emoji unless the voice samples use them.',
  '- Reply directly to the post. No throat-clearing ("Great point", "Interesting take", etc.).',
  '- Never apologize, never moralize, never explain that you are an AI.',
  '- One idea per reply. If you must hedge, hedge once.',
  '- Plain ASCII quotes and dashes. No em-dash unless the voice samples use them.',
].join('\n');

export interface DraftPromptInput {
  voiceSamples: string;
  alphamoltPages: AlphamoltPage[];
  post: Post;
  postClass: PostClass;
  rules?: string;
  candidateCount: number;
}

export function buildDraftSystemPrompt(input: DraftPromptInput): string {
  const { voiceSamples, alphamoltPages, post, postClass, rules, candidateCount } = input;
  const samples = voiceSamples.trim()
    ? `Voice samples (study tone, cadence, vocabulary; do not copy phrasing):\n---\n${voiceSamples.trim()}\n---`
    : 'No voice samples provided. Default to a wry, terse, observational tone.';

  const rulesBlock = (rules?.trim() || DEFAULT_RULES).trim();

  const sections: string[] = [
    "You are drafting a reply on behalf of a user who writes in the voice of Alphamolt. Match that voice tightly: cadence, diction, level of conviction, and use of hedging.",
    samples,
    `Platform: ${post.platform}. ${PLATFORM_LENGTH_RULES[post.platform]}`,
    rulesBlock,
    buildClassBlock(postClass, alphamoltPages),
  ];

  const n = Math.max(1, Math.min(candidateCount, 5));
  sections.push(
    `Output: a JSON array of exactly ${n} distinct candidate replies, ordered by your confidence. Each array element is a string — the reply text only, no preamble or quotes. Make the candidates meaningfully different in angle or phrasing, not three near-duplicates. Output JSON only, no prose, no code fences. Example for 3: ["draft one","draft two","draft three"]`,
  );

  return sections.join('\n\n');
}

function buildClassBlock(
  postClass: PostClass,
  alphamoltPages: AlphamoltPage[],
): string {
  switch (postClass.kind) {
    case 'consensus-ticker':
      return buildConsensusBlock(postClass.primary);
    case 'covered-ticker':
      return buildCoveredBlock(postClass.primary);
    case 'agent':
      return buildAgentBlock(postClass.primary);
    case 'general-ai-finance':
      return buildGeneralAiBlock();
    case 'none':
      return buildNoneBlock(alphamoltPages);
  }
}

function buildConsensusBlock(entry: ConsensusEntry): string {
  return [
    `The user is replying to a post about ${entry.ticker} (${entry.name}), which is on Alphamolt's consensus list.`,
    entry.thesis
      ? `Alphamolt's stance on ${entry.ticker}: "${entry.thesis}"`
      : `Alphamolt has a published view on ${entry.ticker} but no thesis blurb is available; stay generic about the company and let the link carry the weight.`,
    'Ticker-reply rules (override the generic Alphamolt-link rules below):',
    `- Embed the URL ${entry.url} exactly once, naturally inside a sentence. Not at the start, not bracketed, not labeled "link".`,
    '- One tight beat. The reply should land like a contrarian aside, not a thesis.',
    "- If the original post is bullish, the reply leans on Alphamolt's framing without flatly contradicting them. If bearish, same — surface the angle, don't argue.",
    '- Do not paste the thesis verbatim. Compress it to a phrase or implication.',
    '- Mention the ticker (with $ if natural) but do not stack multiple ticker symbols.',
  ].join('\n');
}

function buildCoveredBlock(entry: CompanyEntry): string {
  const url = entry.url || `${COMPANY_PAGE_PREFIX}${entry.ticker}`;
  const name = entry.name ?? entry.ticker;
  return [
    `The user is replying to a post about ${entry.ticker} (${name}). Alphamolt covers this company but does not have a consensus thesis on it.`,
    'Covered-ticker rules:',
    '- Add value casually first — a small specific observation about the business, the setup, or the market reaction. Not a thesis.',
    `- If a single tight angle on this company genuinely improves the reply, you may embed ${url} once, naturally inside a sentence. Otherwise omit the URL entirely.`,
    '- When you do include the URL, do not preface with phrases like "see here" or "more at". Make the link incidental.',
    '- Mention the ticker (with $ if natural) but do not stack multiple symbols.',
    '- Do not invent specific numbers, ratios, or claims. Stay observational.',
  ].join('\n');
}

function buildAgentBlock(entry: AgentEntry): string {
  const lines = [
    `The user is replying to a post about ${entry.name}. ${entry.name} is on Alphamolt's leaderboard${entry.rank !== undefined ? `, currently ranked #${entry.rank}` : ''}.`,
  ];
  if (entry.thesis) {
    lines.push(`Alphamolt's read on ${entry.name}'s investing style: "${entry.thesis}"`);
  } else {
    lines.push(`No specific style note is available for ${entry.name}; lean on the rank and the leaderboard framing.`);
  }
  lines.push(
    'Agent-reply rules (override the generic Alphamolt-link rules below):',
    '- Brief. Sometimes enigmatic — a hook that makes the reader want to click, not a summary.',
    '- One tight beat. Don\'t explain the leaderboard; assume the reader can figure it out from the link.',
    `- Embed ${entry.url} once, naturally. If you can\'t fit the agent-specific link, fall back to ${LEADERBOARD_URL} instead — but never include both.`,
    '- Don\'t stack multiple model names. Don\'t evangelise. Don\'t post a benchmark number.',
    `- It\'s fine to use the model\'s casual name (e.g. just "Gemini") rather than the full versioned form.`,
  );
  return lines.join('\n');
}

function buildGeneralAiBlock(): string {
  return [
    'The post is a general one about LLMs / AI for finance, stock-picking, portfolio construction, or similar.',
    'General-AI rules:',
    '- Contribute substantively first. Make a real point, an observation, or a sharp question.',
    '- Treat plugging Alphamolt as the exception, not the rule. Roughly 1 in 4 replies should end with a single brief gloss like "alphamolt.ai tracks how the major LLMs do this in practice" linking https://www.alphamolt.ai/. The other 3 should not link at all.',
    '- When you do plug, the plug must feel incidental — never the load-bearing part of the reply.',
    '- Do not name a specific model unless the post does first.',
  ].join('\n');
}

function buildNoneBlock(alphamoltPages: AlphamoltPage[]): string {
  const pages = alphamoltPages.length
    ? JSON.stringify(alphamoltPages, null, 2)
    : '[]';
  return [
    `Alphamolt pages you may reference:\n${pages}`,
    'Generic-link rule: if — and only if — exactly one of these pages is directly, substantively relevant to the reply you are drafting, embed its URL inline as a natural sentence. Otherwise omit. Default to omitting; the bar is high. Never include more than one Alphamolt URL.',
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
