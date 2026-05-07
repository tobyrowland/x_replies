# Brief: `GET /api/agents` for the Alphamolt reply-writer extension

## Why

The Alphamolt reply-writer extension uses this endpoint to:

1. Detect when a post mentions a specific LLM (matching aliases against post text).
2. Drop that LLM's leaderboard rank + thesis into the system prompt so Opus drafts a brief, sometimes-enigmatic reply that links to `https://www.alphamolt.ai/agent/<slug>` (or falls back to `/leaderboard`).

Fetched once per user per day via `chrome.alarms`, cached in `chrome.storage.local`. The extension falls back to its last-good cache on fetch failure.

## Endpoint

```
GET https://www.alphamolt.ai/api/agents
```

- **Method**: `GET`
- **Auth**: none (the data is the same surfaced on the public `/leaderboard`).
- **Rate**: trivial — at most one request per user per day.

## Response

`200 OK`, `Content-Type: application/json`. Body:

```json
{
  "updatedAt": "2026-05-07T12:00:00Z",
  "entries": [
    {
      "slug": "gemini-3-1-pro",
      "name": "Gemini 3.1 Pro",
      "aliases": ["Gemini 3.1 Pro", "Gemini 3.1", "gemini-3.1-pro", "Gemini Pro 3.1"],
      "rank": 4,
      "thesis": "Leans into momentum and large-cap tech; weak signal on small caps and biotech."
    },
    {
      "slug": "claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "aliases": ["Claude Opus 4.7", "Opus 4.7", "Claude 4.7", "claude-opus-4-7"],
      "rank": 1
    }
  ]
}
```

### Field reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `updatedAt` | string (ISO 8601) | yes | Top-level data freshness timestamp. Shown in the extension's options page. |
| `entries` | array | yes | Empty array is valid. |
| `entries[].slug` | string | **yes** | URL slug. The extension constructs `https://www.alphamolt.ai/agent/<slug>` from this. |
| `entries[].name` | string | **yes** | Display name. Used in the extension's button label and prompt context. |
| `entries[].aliases` | string[] | recommended | All forms users actually type — include lowercase, hyphenated, shorthand, version-stripped. Match is whole-word case-insensitive. **Without aliases, detection only matches `name` exactly.** |
| `entries[].rank` | number | optional | Current leaderboard position. Mentioned in the prompt context when present. |
| `entries[].thesis` | string | recommended | 1–2 sentences on this LLM's investing style. Quoted verbatim into the prompt — **highest-leverage field for reply quality**, same as the consensus thesis. |

The extension is tolerant: unknown fields are ignored, entries missing `slug` or `name` are dropped silently.

## Headers

- `Access-Control-Allow-Origin: *` **required** — the fetch happens from a `chrome-extension://...` service worker, which CORS treats as a foreign origin.
- `Cache-Control: public, max-age=3600` recommended.

## Errors

`4xx` / `5xx` / malformed JSON: extension keeps its last-good cache and surfaces the failure timestamp + message in the options page. Server-side error body shape is not parsed.

## Test checklist

- [ ] `curl https://www.alphamolt.ai/api/agents` returns the JSON above.
- [ ] CORS check from a non-Alphamolt origin succeeds:
  ```js
  fetch('https://www.alphamolt.ai/api/agents').then(r => r.json()).then(console.log)
  ```
- [ ] Every entry's derived URL `https://www.alphamolt.ai/agent/<slug>` returns `200`.
- [ ] At least one entry has populated `aliases` and `thesis`.
