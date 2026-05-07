# Brief: `GET /api/consensus` for the Alphamolt reply-writer extension

## Why

The Alphamolt reply-writer Chrome extension (repo: `tobyrowland/x_replies`) needs to know which tickers are on Alphamolt's consensus list so it can:

1. Highlight posts on X / Bluesky / Reddit that mention a consensus ticker.
2. Draft a pithy, ticker-aware reply that links to `https://www.alphamolt.ai/company/{TICKER}`, grounded in Alphamolt's stated thesis.

The extension fetches this endpoint **once per day per user** (via `chrome.alarms`, period 1440 min), caches the result in `chrome.storage.local`, and falls back to the stale cache if a fetch fails. The whole list is small (<60 entries), so no pagination, no incremental sync.

## Endpoint

```
GET https://www.alphamolt.ai/api/consensus
```

- **Method**: `GET`
- **Auth**: none (the response is the same data already public on `/consensus`).
- **Rate limit**: trivial — at most one request per user per day. A burst on extension install is fine.

## Response

`200 OK`, `Content-Type: application/json`. Body:

```json
{
  "updatedAt": "2026-05-07T12:00:00Z",
  "entries": [
    {
      "ticker": "SEZL",
      "name": "Sezzle Inc.",
      "thesis": "Profitable BNPL operator with improving unit economics; market still pricing it as a 2021 fintech wreck.",
      "url": "https://www.alphamolt.ai/company/SEZL"
    },
    {
      "ticker": "TSLA",
      "name": "Tesla, Inc.",
      "thesis": "Auto margins compressing; valuation pinned to FSD/robotaxi optionality that keeps slipping right."
    }
  ]
}
```

### Field reference

| Field        | Type   | Required | Notes |
|--------------|--------|----------|-------|
| `updatedAt`  | string (ISO 8601) | yes | Top-level "data freshness" timestamp. Shown in the extension's options page. |
| `entries`    | array  | yes | The consensus list. Empty array is valid. |
| `entries[].ticker` | string | **yes** | Canonical uppercase symbol, no `$` prefix. `[A-Z]{1,5}`. |
| `entries[].name` | string | **yes** | Display name, e.g. "Sezzle Inc.". Used in the LLM prompt. |
| `entries[].thesis` | string | recommended | 1–2 sentences of Alphamolt's stance. **This is the highest-leverage field** — it's quoted verbatim into the draft prompt, so reply quality scales directly with how good these are. ~280 chars max is a good target. If omitted, the prompt still mandates the URL but lacks specific framing. |
| `entries[].url` | string | optional | Override URL. If omitted, the extension derives `https://www.alphamolt.ai/company/{TICKER}`. Only set this if a ticker's canonical page doesn't follow the pattern. |
| `entries[].updatedAt` | string (ISO 8601) | optional | Per-entry last-updated. Currently unused by the extension but harmless to include. |

The extension is tolerant: unknown fields are ignored, missing optional fields are filled in with derived defaults, and any entry missing `ticker` or `name` is dropped silently.

## Headers

- `Access-Control-Allow-Origin: *` **required** — the extension fetches from a `chrome-extension://...` service worker, which CORS treats as a foreign origin. Without this header the request fails.
  - If you want to lock it down, allow `chrome-extension://<EXT_ID>` once we publish to the Web Store. Until then, `*` is fine because there's nothing private in the response.
- `Cache-Control: public, max-age=3600` recommended (or longer). The extension already caches client-side daily; a CDN cache just protects the origin.

## Errors

- `4xx`/`5xx`: extension keeps using its last-good cache and surfaces the failure in the options page (last-fetched timestamp + error). Do whatever's easiest on the server side — JSON error body is fine but not parsed.
- `200 OK` with malformed JSON: same fallback behavior; we treat it as a failed fetch.

## Test checklist

- [ ] `curl https://www.alphamolt.ai/api/consensus` from a non-browser context returns the JSON above.
- [ ] Browser fetch from a different origin succeeds (CORS headers present). Quick check:
  ```js
  fetch('https://www.alphamolt.ai/api/consensus').then(r => r.json()).then(console.log)
  ```
  Run from the DevTools console on any other site (e.g. example.com).
- [ ] Every entry's derived URL (`https://www.alphamolt.ai/company/{TICKER}`) returns `200`.
- [ ] At least one entry has a populated `thesis` so the draft-quality test in the extension is meaningful.

## Versioning

Add a top-level `"version": 1` if/when the shape changes. The extension currently ignores the field; bump it only when adding required fields, and we'll gate on it client-side then.
