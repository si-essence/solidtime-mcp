# solidtime-mcp (Solidtime MCP connector)

MCP connector for a [Solidtime](https://github.com/solidtime-io/solidtime) instance. It speaks public REST API v1 over stdio and over stateless Streamable HTTP on localhost.

Solidtime is AGPL-3.0 software. Self-host it, or point this connector at your own cloud account. This connector does not grant any right to the Solidtime name, and it does not imply endorsement.

This connector is MIT. It is a BYO-token client. It only calls the public REST API. It is not affiliated with solidtime-io.

The connector covers all 81 operations in `solidtime.openapi.json` plus the extra client routes in `solidtime.client-routes.ts.txt` (99 operations, 53 tools). Week copy and timesheet bulk entry are not on the public REST API, so they are not tools. Project and task estimates use `estimated_time` in seconds.

## Setup

```bash
npm install
npm run ci
npm start
npm run start:http
```

`npm start` speaks stdio. `npm run start:http` serves Streamable HTTP at `http://127.0.0.1:3000/mcp` and `GET /health`. HTTP mode has no authentication. Keep it on localhost.

Create a personal API token in Solidtime under Profile settings, Create API Token. The connector sends it as `Authorization: Bearer <token>` and never prints it.

```json
{
  "mcpServers": {
    "solidtime": {
      "command": "node",
      "args": ["/workspace/connectors/solidtime/dist/index.js"],
      "env": {
        "SOLIDTIME_URL": "http://127.0.0.1:8088",
        "SOLIDTIME_API_TOKEN": "...",
        "SOLIDTIME_ORGANIZATION_ID": "...",
        "SOLIDTIME_ALLOW_WRITES": "false",
        "SOLIDTIME_CONTACT": "you@example.com"
      }
    }
  }
}
```

Cloud accounts use `https://app.solidtime.io` as `SOLIDTIME_URL`. A trailing `/api` is stripped.

Docker (HTTP, no authentication, localhost only):

```bash
docker build -t solidtime-mcp .
docker run -p 3000:3000 \
  -e SOLIDTIME_URL=http://host.docker.internal:8088 \
  -e SOLIDTIME_API_TOKEN=... \
  solidtime-mcp
```

Do not put the API token in the image.

## Tools

| Tool                                      | Call                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `solidtime_me`                            | `GET /api/v1/users/me`                                                |
| `solidtime_memberships`                   | `GET /api/v1/users/me/memberships`                                    |
| `solidtime_user_update`                   | `PUT /api/v1/users/{user}`                                            |
| `solidtime_user_set_organization`         | `PUT /api/v1/users/me/current-organization`                           |
| `solidtime_user_delete`                   | `DELETE /api/v1/users/{user}`                                         |
| `solidtime_user_email`                    | resend verification or reset pending email                            |
| `solidtime_api_tokens`                    | list, create, revoke, delete                                          |
| `solidtime_countries`                     | `GET /api/v1/countries`                                               |
| `solidtime_currencies`                    | `GET /api/v1/currencies`                                              |
| `solidtime_time_zones`                    | `GET /api/v1/time-zones`                                              |
| `solidtime_organization_get`              | `GET .../organizations/{organization}`                                |
| `solidtime_organization_create`           | `POST /api/v1/organizations`                                          |
| `solidtime_organization_update`           | `PUT .../organizations/{organization}`                                |
| `solidtime_organization_delete`           | `DELETE .../organizations/{organization}`                             |
| `solidtime_members_list`                  | `GET .../members`                                                     |
| `solidtime_member_update`                 | `PUT .../members/{member}`                                            |
| `solidtime_member_remove`                 | `DELETE .../members/{member}`                                         |
| `solidtime_member_invite_placeholder`     | `POST .../invite-placeholder`                                         |
| `solidtime_member_make_placeholder`       | `POST .../make-placeholder`                                           |
| `solidtime_member_merge`                  | `POST .../member/{member}/merge-into`                                 |
| `solidtime_invitations`                   | list, invite, resend, remove                                          |
| `solidtime_projects_list`                 | `GET .../projects`                                                    |
| `solidtime_project_get`                   | `GET .../projects/{project}`                                          |
| `solidtime_project_create`                | `POST .../projects`                                                   |
| `solidtime_project_update`                | `PUT .../projects/{project}`                                          |
| `solidtime_project_delete`                | `DELETE .../projects/{project}`                                       |
| `solidtime_project_members`               | list, create, update, delete                                          |
| `solidtime_clients`                       | list, create, update, delete                                          |
| `solidtime_tags`                          | list, create, update, delete                                          |
| `solidtime_tasks`                         | list, create, update, delete                                          |
| `solidtime_goals`                         | list, get, create, update, delete                                     |
| `solidtime_time_entries_list`             | `GET .../time-entries`                                                |
| `solidtime_time_entry_create`             | `POST .../time-entries`                                               |
| `solidtime_time_entry_update`             | `PUT .../time-entries/{timeEntry}`                                    |
| `solidtime_time_entry_delete`             | `DELETE .../time-entries/{timeEntry}`                                 |
| `solidtime_time_entries_bulk_update`      | `PATCH .../time-entries`                                              |
| `solidtime_time_entries_bulk_delete`      | `DELETE .../time-entries?ids[]`                                       |
| `solidtime_time_entries_export`           | `GET .../time-entries/export`                                         |
| `solidtime_time_entries_aggregate`        | `GET .../time-entries/aggregate`                                      |
| `solidtime_time_entries_aggregate_export` | `GET .../time-entries/aggregate/export`                               |
| `solidtime_timer_active`                  | `GET /api/v1/users/me/time-entries/active`                            |
| `solidtime_timer_start`                   | create a time entry with `end=null`                                   |
| `solidtime_timer_stop`                    | set `end` on the active entry                                         |
| `solidtime_reports`                       | list, get, create, update, delete                                     |
| `solidtime_public_report`                 | `GET /api/v1/public/reports` with `X-Api-Key` set to the share secret |
| `solidtime_charts`                        | dashboard chart endpoints                                             |
| `solidtime_importers`                     | `GET .../importers`                                                   |
| `solidtime_import`                        | `POST .../import`                                                     |
| `solidtime_export_organization`           | `POST .../export`                                                     |
| `solidtime_invoice_settings`              | get or update. Professional                                           |
| `solidtime_invoice_recipients`            | list, get, create, update, delete, duplicate. Professional            |
| `solidtime_invoices`                      | list, get, create, update, delete, copy, download. Professional       |
| `solidtime_cancel_trial`                  | `POST .../trial/cancel`                                               |

`member_id` is the membership id from `solidtime_memberships`, not the user id.

`billable_rate` is cents per hour. Changing it can reprice existing time entries.

When no timer is running, `solidtime_timer_active` returns `{ data: null, active: false }`.

Professional invoice routes that are missing on the instance return a not-available error.

## Environment

| Variable                    | Default                    | Role                                                                                 |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `SOLIDTIME_URL`             | `https://app.solidtime.io` | Instance origin. No userinfo, query, or hash. A trailing `/api` is stripped          |
| `SOLIDTIME_API_TOKEN`       | unset                      | Required for an upstream call. At least 8 characters. Never printed                  |
| `SOLIDTIME_ORGANIZATION_ID` | unset                      | Optional org UUID. Auto-detected when the user has exactly one membership            |
| `SOLIDTIME_ALLOW_WRITES`    | off                        | The literal `true` enables writes. Any other value keeps writes as a blocked preview |
| `SOLIDTIME_CONTACT`         | `contact@example.com`      | Contact inside the User-Agent. Must not contain the token                            |
| `SOLIDTIME_PER_MINUTE`      | `200`                      | Local sliding-window cap                                                             |
| `SOLIDTIME_CACHE_TTL_SEC`   | `60`                       | TTL for successful reads. `0` disables the cache                                     |
| `SOLIDTIME_TIMEOUT_MS`      | `20000`                    | Upstream timeout                                                                     |
| `MCP_TRANSPORT`             | `stdio`                    | `stdio` or `http`. `--http` forces HTTP                                              |
| `PORT`                      | `3000`                     | HTTP listen port                                                                     |

Invalid values are reported by field name and issue code. The rejected value is not included.

## Safety

A write tool returns a dry-run preview when `confirm` is omitted. The preview is the method, path, query, and body that would be sent. Secrets are redacted.

`confirm` must be the boolean `true`. `false` and the string `"true"` are rejected.

When `confirm` is `true` and `SOLIDTIME_ALLOW_WRITES` is not `true`, the tool still returns the preview, sets `blocked` to true, and does not call the instance.

Writes include POST, PUT, PATCH, DELETE, timer start and stop, bulk time-entry update and delete, invites, rate changes, import, export, and trial cancel.

Rate-change previews warn that existing time entries can be repriced. Delete and bulk previews warn that the action is irreversible.

The API token is removed from tool results, error text, and logs, including its URL-encoded form. It is refused in the query string, the base URL, the User-Agent, and a JSON request body. `access_token`, password, and Authorization values are redacted. Absolute server filesystem paths are dropped.

HTTP 401 is `[upstream]` authentication failed. HTTP 402 is `[upstream]` with a quota or payment note. HTTP 403 for a missing Professional feature is `[upstream]` not available on this plan or instance. HTTP 404 is `[not-found]`. HTTP 422 surfaces validation messages. HTTP 429 is `[rate-limit]` with Retry-After and the 200/min cap.

HTTP mode has no authentication. Do not expose it beyond localhost.

## Licence

Solidtime is AGPL-3.0 (https://github.com/solidtime-io/solidtime). This connector is MIT. It only calls the public REST API. Bring your own token. Not affiliated with solidtime-io.

## License

MIT, see [LICENSE](LICENSE). This is an independent, unofficial connector and is not endorsed by the Solidtime project or its owners.

The upstream solidtime.openapi.json comes from a AGPL-3.0 project, so it is not shipped here. `src/operations.ts` was generated from it, and tests fall back to a route-only fixture in `test/fixtures/`. To regenerate, download the spec from the upstream project into the repo root (it is gitignored) and run `node scripts/gen-operations.mjs`.
