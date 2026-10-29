# Live check against local Solidtime (latest main)

Date: 25 Oct 2026. Instance at `$SOLIDTIME_URL` (`http://127.0.0.1:8088`). API token never printed.

Command: `SOLIDTIME_ALLOW_WRITES=true SOLIDTIME_PER_MINUTE=120 npm run live-check` after `npm run ci`.

Created clients, tags, projects, tasks, goals, time entries, a running timer, a public report, and a temporary API token named with an `mcp-live-*` prefix. Writes were previewed without `confirm`, then executed with `confirm: true` where it was safe. Then those objects were deleted. User name and organization name were restored to `Live Test` / `Live's Organization`. The original token named `live` was left in place.

## Result

`failed=0`. No HTTP 402 or quota error.

53 tools were published. 51 were invoked through the MCP client. Write tools were previewed without `confirm`. Confirmed writes that create isolated test data were executed and then cleaned up.

## Tools invoked live (upstream call or dry-run through the MCP tool)

Reads that hit the API: `solidtime_me`, `solidtime_memberships`, `solidtime_countries` (HTTP 404, route missing on this build), `solidtime_currencies`, `solidtime_time_zones`, `solidtime_organization_get`, `solidtime_members_list`, `solidtime_api_tokens` list, `solidtime_invitations` list, `solidtime_clients` list, `solidtime_tags` list, `solidtime_projects_list`, `solidtime_project_get`, `solidtime_project_members` list, `solidtime_tasks` list, `solidtime_goals` list/get, `solidtime_time_entries_list`, `solidtime_time_entries_aggregate`, `solidtime_timer_active`, `solidtime_reports` list/get, `solidtime_public_report` (share secret sent as `X-Api-Key`), `solidtime_charts` (all 9 actions), `solidtime_importers`, `solidtime_invoice_settings` get, `solidtime_invoice_recipients` list, `solidtime_invoices` list.

Confirmed writes that hit the API: `solidtime_organization_update` (name, then restore, no billable_rate), `solidtime_user_update` (name, then restore), `solidtime_user_set_organization`, `solidtime_api_tokens` create/revoke/delete (new `mcp-live-*` token only), `solidtime_clients` create/update/delete, `solidtime_tags` create/update/delete, `solidtime_project_create`/`update`/`delete`, `solidtime_project_members` create, `solidtime_tasks` create/update/delete, `solidtime_goals` create/update/delete, `solidtime_time_entry_create`/`update`, `solidtime_time_entries_bulk_update`, `solidtime_timer_start`/`stop`, `solidtime_reports` create/update/delete, `solidtime_time_entries_bulk_delete`, `solidtime_time_entry_delete`.

Dry-run only (tool ran, request not sent): `solidtime_organization_create`, `solidtime_organization_delete`, `solidtime_user_delete`, `solidtime_user_email`, `solidtime_member_update` (rate-change preview, repricing warning present), `solidtime_member_remove`, `solidtime_member_invite_placeholder`, `solidtime_member_make_placeholder`, `solidtime_member_merge`, `solidtime_invitations` invite, `solidtime_project_members` update and delete, `solidtime_import`, `solidtime_export_organization`, `solidtime_invoice_settings` update, `solidtime_invoice_recipients` create, `solidtime_invoices` create, `solidtime_cancel_trial`.

## Not invoked live, and why

| Tool                                      | Why                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `solidtime_time_entries_export`           | GET `/time-entries/export` did not return within 25s on this PHP built-in server and blocked other requests. Not called on the successful run. |
| `solidtime_time_entries_aggregate_export` | Same hang class as time-entries export. Not called.                                                                                            |

Week copy and timesheet bulk entry are not on public REST API v1. There is no tool for them.

## Instance limits

This self-hosted build has no `/api/v1/countries` route (HTTP 404). Currencies and time zones exist.

Invoice settings, recipients, and invoices return HTTP 404 `API resource not found`. The connector maps that to `not available on this plan or instance`. Confirmed invoice writes were not sent.

`GET /users/me/time-entries/active` returns HTTP 404 `No active time entry` when idle. The connector returns `{ data: null, active: false }`.

Organization delete requires the account password. This check has no password in env, so org create/delete were preview only.

POST invitations waits on SMTP here (about 1 minute) and stalls the PHP server. Invite execute was skipped after that was measured on an earlier run.

Rate changes were previewed only, so existing entries were not repriced.

No tool output contained the API token.

## Cleanup

`mcp-live-*` clients, tags, projects, tasks, goals, reports, time entries, and the temporary API token from the successful run were deleted. Remaining: user `Live Test`, organization `Live's Organization`, API token `live`.

An earlier aborted run left organization `mcp-live-1792921664732-org` (`a6a7e986-7908-47a8-ac7b-297b56c91ba0`). DELETE `/organizations/{id}` returned 422 `The password field is required.` That org is still present. The live org used by this check was not deleted.
