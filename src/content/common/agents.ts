import type { AgentHit } from '@/shared/types';
import { type AliasIndex, normalize } from '@/shared/agents';

const MAX_HITS_PER_POST = 1;

export function extractAgentHits(text: string, index: AliasIndex): AgentHit[] {
  if (!text || index.byNormalizedAlias.size === 0) return [];
  const haystack = normalize(text);
  const hits = new Map<string, AgentHit>();
  for (const [alias, entry] of index.byNormalizedAlias) {
    if (!haystack.includes(alias)) continue;
    if (!matchesWholeWord(haystack, alias)) continue;
    if (hits.has(entry.slug)) continue;
    hits.set(entry.slug, { entry, matchedAlias: alias });
    if (hits.size >= MAX_HITS_PER_POST) break;
  }
  return Array.from(hits.values());
}

const WORD_BOUNDARY = /[\s.,;:!?()\[\]{}"'`/\\<>]/;

function matchesWholeWord(haystack: string, needle: string): boolean {
  let from = 0;
  while (true) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const left = at === 0 ? '' : haystack[at - 1] ?? '';
    const right = haystack[at + needle.length] ?? '';
    const leftOk = at === 0 || WORD_BOUNDARY.test(left);
    const rightOk =
      at + needle.length === haystack.length || WORD_BOUNDARY.test(right);
    if (leftOk && rightOk) return true;
    from = at + 1;
  }
}
