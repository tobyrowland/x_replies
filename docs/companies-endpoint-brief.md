# Brief: `GET /api/companies` for the Alphamolt reply-writer extension

## Why

The reply-writer detects ticker mentions in post text (cashtags + bare uppercase). For *consensus* tickers it has thesis blurbs from `/api/consensus`. For *non-consensus, but Alphamolt-covered* tickers, it needs to verify the page exists at `/company/<TICKER>` before letting the draft link to it.

This endpoint is the **superset** — every ticker Alphamolt has any page for. Cached per user, refreshed daily.

## Endpoint

```
GET https://www.alphamolt.ai/api/companies
```

- **Method**: `GET`
- **Auth**: none.
- **Rate**: trivial — at most one request per user per day.

## Response

`200 OK`, `Content-Type: application/json`. Body:

```json
{
  "updatedAt": "2026-05-07T12:00:00Z",
  "entries": [
    { "ticker": "SEZL", "name": "Sezzle Inc." },
    { "ticker": "RDDT", "name": "Reddit, Inc." },
    { "ticker": "TSLA", "name": "Tesla, Inc." }
  ]
}
```

### Field reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `updatedAt` | string (ISO 8601) | yes | |
| `entries` | array | yes | Empty array is valid. |
| `entries[].ticker` | string | **yes** | Canonical uppercase, `[A-Z]{1,5}`. |
| `entries[].name` | string | optional | Display name. Used in the prompt context when present. |
| `entries[].url` | string | optional | Override URL. Defaults to `https://www.alphamolt.ai/company/<TICKER>`. |

## Invariants

- **Every ticker in `/api/consensus` MUST also appear in `/api/companies`.** The consensus list is a strict subset. The extension assumes this; mismatches mean a consensus ticker would lose its company-page link.
- Tickers should be deduplicated; first occurrence wins on conflict.

## Headers

- `Access-Control-Allow-Origin: *` **required**.
- `Cache-Control: public, max-age=3600` recommended.

## Errors

`4xx` / `5xx` / malformed JSON: extension keeps last-good cache, surfaces the failure in options.

## Test checklist

- [ ] `curl https://www.alphamolt.ai/api/companies` returns the JSON above.
- [ ] CORS check from a non-Alphamolt origin succeeds.
- [ ] Spot-check 5 random entries — each `https://www.alphamolt.ai/company/<TICKER>` returns `200`.
- [ ] Set-difference: every `ticker` in `/api/consensus` also appears in `/api/companies`.
