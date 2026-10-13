# Swagger live audit report

**Target:** `http://localhost:4000`  
**Scope:** the 24 operations exposed by `GET /api/v1/openapi.json`  
**Result:** 35 live checks executed: **35 passed**, **0 unexpected responses**.

This is not a claim that every possible provider action was sent to WhatsApp. A
real text send, report lookup, Meta media upload, template synchronisation, and
campaign scheduling were exercised. Operations that create a permanent Meta
template, a user, or a bulk contact set are marked **partial** rather than
being described as fully proven.

## Endpoint results

| Endpoint | Live result | Conditions exercised | Status |
|---|---|---|---|
| `GET /whatsapp/metaPayment/configs/active` | `200` | authenticated read; missing credentials returned `401` on the shared legacy guard | Pass |
| `POST /whatsapp/sendMessage` | `200` on the user-authorized real text send; report entry and Meta message id were saved | invalid/missing message returned `400`; authentication returned `401` | Pass, delivery callback pending |
| `POST /whatsapp/sendMessageByCampaign1` | `200` | missing CSV returned `400`; a future campaign was created, appeared in the schedule list, then was cancelled before dispatch | Pass for scheduling; dispatch not sent |
| `GET /whatsapp/schedule/campaign/list` | `200` | newly scheduled campaign was visible | Pass |
| `DELETE /whatsapp/schedule/campaign/{campaignId}` | `200` | created future campaign cancelled; missing id returned `404` | Pass |
| `POST /whatsapp/meta/media/upload` | `200` | missing file `400`; a 1px PNG was uploaded to Meta | Pass |
| `GET /whatsapp/media/mediaDetail/{metaMediaId}` | `200` | detail was fetched for the just-uploaded Meta media id | Pass |
| `POST /messageTemplate/create` | `400` for invalid name | invalid-name validation works; valid provider creation intentionally not run because it creates a durable Meta template and this API has no delete operation | Partial |
| `POST /messageTemplate/getTemplates` | `200` | pagination request | Pass |
| `GET /messageTemplate/syncTemplatesFromMeta` | `200` | real Meta synchronisation | Pass |
| `GET /whatsapp/syncTemplatesFromMeta` | `200` | real Meta synchronisation through the alias route | Pass |
| `GET /whatsapp/report/userMessageId/{id}` | `200` | real message report found; unknown id `404` | Pass |
| `POST /whatsapp/report/messageSentReport` | `200` | paginated report list | Pass |
| `POST /contact/list` | `200` | user-authorized recipient was present after live send | Pass |
| `POST /contact/save` | `400` for missing phone | successful upsert was tested earlier in this local session; this audit did not overwrite contact data again | Partial |
| `POST /contact/upload` | `400` for missing CSV | valid import not run because it permanently changes contacts and there is no delete endpoint | Partial |
| `POST /user/agent` | `400` for missing required fields | valid create not run because it permanently creates a login user and there is no delete endpoint | Partial |
| `GET /user/agent-list` | `200` | authenticated list | Pass |
| `GET /user/team-list` | `200` | authenticated list | Pass |
| `GET /user/teams` | `200` | authenticated list | Pass |
| `POST /whatsapp/chat/assignment` | `400` for invalid target; `404` for absent contact | valid assignment not changed because it would alter an existing conversation assignment | Partial |
| `POST /messages` | `400` for invalid payload; a real single public send returned `201` earlier in this local session | missing API key `401` | Pass, delivery callback pending |
| `POST /messages/bulk` | `400` for invalid idempotency/payload | valid bulk job not queued because it sends real WhatsApp messages | Partial |
| `GET /messages/bulk/{job_id}` | `404` for unknown job | valid job detail depends on deliberately not queuing a live bulk send | Partial |

## Documentation / contract defects found

These do **not** mean the local backend is down. They are mismatches between
Swagger and actual runtime behavior that should be fixed before publishing the
documentation as an exact API contract.

1. **`x-phone-id` is documented on all legacy WhatsApp operations but is not
   consumed by the backend.** The routes select the account configuration
   through the API key or Basic-login account. With more than one connected
   phone number, the header will not select a phone number as the Swagger file
   suggests.
2. **`POST /api/v1/user/agent` documents success as `200`, but the route
   returns `201 Created`.**
3. **`POST /api/v1/whatsapp/chat/assignment` documents `202`, but the route
   only returns `200` on success.** It also can return `403`, `404`, and `409`,
   which are not documented.
4. **Several documented error responses are incomplete.** For example,
   `messageTemplate/create` documents only `200` but can return validation,
   authorization, and provider errors; report-by-id and schedule-cancel can
   return `404`; agent creation can return `201`, `403`, or `409`.
5. **`POST /api/v1/messages` documents an `Idempotency-Key` request header,
   but the current route does not read it.** Bulk idempotency is instead read
   from JSON body field `idempotency_key`; single-send idempotency is not
   implemented.
6. **The live backend has `GET /api/v1/me`, but it is absent from Swagger.**
   This is useful for safely checking that an API key is accepted and which
   scopes it has.
7. **Bulk-job parameter naming differs.** Swagger calls the path parameter
   `job_id`; the Express route names it `id`. The URL works, but generated
   client SDKs should use a consistent parameter name.

## Delivery-status limitation

The direct text send was accepted by Meta and persisted with a real WhatsApp
message id. It is **not yet delivery-confirmed** through the backend because
the current local configuration uses `localhost` and has no configured Meta
webhook verification secret/token. Meta cannot call a localhost webhook to
post `delivered`, `read`, or `failed` status events. This is independent from
outbound sending.

## Test cleanup

- All temporary API keys created for this audit were deleted.
- The future campaign was cancelled before it could send.
- The tiny uploaded Meta media asset remains at Meta because this Swagger API
  exposes no media-delete operation.
