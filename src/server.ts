import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodObject, type ZodRawShape } from "zod";
import { toolDescription, toolName } from "./brand.js";
import {
  countries,
  countriesInput,
  currencies,
  currenciesInput,
  clients,
  clientsInput,
  goals,
  goalsInput,
  tags,
  tagsInput,
  tasks,
  tasksInput,
  timeZones,
  timeZonesInput,
} from "./catalog-tools.js";
import { CONNECTOR_NAME, CONNECTOR_TITLE, CONNECTOR_VERSION } from "./constants.js";
import {
  invoiceRecipients,
  invoiceRecipientsInput,
  invoiceSettings,
  invoiceSettingsInput,
  invoices,
  invoicesInput,
} from "./invoice-tools.js";
import {
  invitations,
  invitationsInput,
  memberInvitePlaceholder,
  memberInvitePlaceholderInput,
  memberMakePlaceholder,
  memberMakePlaceholderInput,
  memberMerge,
  memberMergeInput,
  memberRemove,
  memberRemoveInput,
  memberUpdate,
  memberUpdateInput,
  membersList,
  membersListInput,
  organizationCreate,
  organizationCreateInput,
  organizationDelete,
  organizationDeleteInput,
  organizationGet,
  organizationGetInput,
  organizationUpdate,
  organizationUpdateInput,
  projectCreate,
  projectCreateInput,
  projectDelete,
  projectDeleteInput,
  projectGet,
  projectGetInput,
  projectMembers,
  projectMembersInput,
  projectUpdate,
  projectUpdateInput,
  projectsList,
  projectsListInput,
} from "./org-tools.js";
import {
  cancelTrial,
  cancelTrialInput,
  charts,
  chartsInput,
  exportOrganization,
  exportOrganizationInput,
  importData,
  importInput,
  importers,
  importersInput,
  publicReport,
  publicReportInput,
  reports,
  reportsInput,
} from "./report-tools.js";
import type { Runtime } from "./runtime.js";
import {
  timeEntriesAggregate,
  timeEntriesAggregateExport,
  timeEntriesAggregateExportInput,
  timeEntriesAggregateInput,
  timeEntriesBulkDelete,
  timeEntriesBulkDeleteInput,
  timeEntriesBulkUpdate,
  timeEntriesBulkUpdateInput,
  timeEntriesExport,
  timeEntriesExportInput,
  timeEntriesList,
  timeEntriesListInput,
  timeEntryCreate,
  timeEntryCreateInput,
  timeEntryDelete,
  timeEntryDeleteInput,
  timeEntryUpdate,
  timeEntryUpdateInput,
  timerActive,
  timerActiveInput,
  timerStart,
  timerStartInput,
  timerStop,
  timerStopInput,
} from "./time-tools.js";
import {
  READ_ONLY_REMOTE,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
  WRITE_NON_IDEMPOTENT,
  registerConnectorTool,
  type ToolAnnotations,
  type ToolContext,
} from "./tools.js";
import {
  apiTokens,
  apiTokensInput,
  me,
  meInput,
  memberships,
  membershipsInput,
  userDelete,
  userDeleteInput,
  userEmail,
  userEmailInput,
  userSetOrganization,
  userSetOrganizationInput,
  userUpdate,
  userUpdateInput,
} from "./user-tools.js";

function publish<Shape extends ZodRawShape>(
  server: McpServer,
  ctx: ToolContext,
  name: string,
  description: string,
  inputSchema: ZodObject<Shape>,
  annotations: ToolAnnotations,
  handler: (args: z.output<ZodObject<Shape>>) => Promise<Record<string, unknown>>,
): void {
  registerConnectorTool(
    server,
    {
      name: toolName(name),
      description: toolDescription(description),
      inputSchema,
      annotations,
      handler,
    },
    ctx,
  );
}

export function createServer(runtime: Runtime): McpServer {
  const server = new McpServer({
    name: CONNECTOR_NAME,
    title: CONNECTOR_TITLE,
    version: CONNECTOR_VERSION,
  });
  const ctx: ToolContext = { secrets: runtime.secrets, logger: runtime.logger };

  publish(
    server,
    ctx,
    "solidtime_me",
    "Get the authenticated Solidtime user. GET /api/v1/users/me. Authorization Bearer token. Never returns the token.",
    meInput,
    READ_ONLY_REMOTE,
    () => me(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_memberships",
    "List organization memberships of the authenticated user. GET /api/v1/users/me/memberships. Used to auto-detect SOLIDTIME_ORGANIZATION_ID.",
    membershipsInput,
    READ_ONLY_REMOTE,
    () => memberships(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_user_update",
    "Update the authenticated user. PUT /api/v1/users/{user}. Omit confirm for a dry-run.",
    userUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => userUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_user_set_organization",
    "Set the current organization. PUT /api/v1/users/me/current-organization. Omit confirm for a dry-run.",
    userSetOrganizationInput,
    WRITE_IDEMPOTENT,
    (args) => userSetOrganization(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_user_delete",
    "Delete a user. DELETE /api/v1/users/{user}. Irreversible. Omit confirm for a dry-run.",
    userDeleteInput,
    WRITE_DESTRUCTIVE,
    (args) => userDelete(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_user_email",
    "Pending email helpers. action resend_verification or reset_pending. Writes need confirm.",
    userEmailInput,
    WRITE_NON_IDEMPOTENT,
    (args) => userEmail(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_api_tokens",
    "API tokens of the current user. action list, create, revoke, delete. Newly created access_token values are redacted. Writes need confirm.",
    apiTokensInput,
    WRITE_DESTRUCTIVE,
    (args) => apiTokens(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_countries",
    "List countries. GET /api/v1/countries. From the app client routes.",
    countriesInput,
    READ_ONLY_REMOTE,
    () => countries(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_currencies",
    "List currencies. GET /api/v1/currencies.",
    currenciesInput,
    READ_ONLY_REMOTE,
    () => currencies(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_time_zones",
    "List time zones. GET /api/v1/time-zones.",
    timeZonesInput,
    READ_ONLY_REMOTE,
    () => timeZones(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_organization_get",
    "Get an organization. GET /api/v1/organizations/{organization}. organization_id is optional when SOLIDTIME_ORGANIZATION_ID is set.",
    organizationGetInput,
    READ_ONLY_REMOTE,
    (args) => organizationGet(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_organization_create",
    "Create an organization. POST /api/v1/organizations. Omit confirm for a dry-run.",
    organizationCreateInput,
    WRITE_NON_IDEMPOTENT,
    (args) => organizationCreate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_organization_update",
    "Update an organization. PUT /api/v1/organizations/{organization}. Changing billable_rate can reprice past entries. Omit confirm for a dry-run.",
    organizationUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => organizationUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_organization_delete",
    "Delete an organization. DELETE /api/v1/organizations/{organization}. Irreversible. Omit confirm for a dry-run.",
    organizationDeleteInput,
    WRITE_DESTRUCTIVE,
    (args) => organizationDelete(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_members_list",
    "List organization members. GET /api/v1/organizations/{organization}/members.",
    membersListInput,
    READ_ONLY_REMOTE,
    (args) => membersList(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_member_update",
    "Update a member role or billable rate. PUT .../members/{member}. Rate changes can reprice past entries. Omit confirm for a dry-run.",
    memberUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => memberUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_member_remove",
    "Remove a member. DELETE .../members/{member}. Irreversible. Omit confirm for a dry-run.",
    memberRemoveInput,
    WRITE_DESTRUCTIVE,
    (args) => memberRemove(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_member_invite_placeholder",
    "Invite a placeholder member to become a real member. POST .../invite-placeholder. Omit confirm for a dry-run.",
    memberInvitePlaceholderInput,
    WRITE_NON_IDEMPOTENT,
    (args) => memberInvitePlaceholder(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_member_make_placeholder",
    "Turn a member into a placeholder. POST .../make-placeholder. Omit confirm for a dry-run.",
    memberMakePlaceholderInput,
    WRITE_NON_IDEMPOTENT,
    (args) => memberMakePlaceholder(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_member_merge",
    "Merge one member into another. POST .../member/{member}/merge-into. Irreversible. Omit confirm for a dry-run.",
    memberMergeInput,
    WRITE_DESTRUCTIVE,
    (args) => memberMerge(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_invitations",
    "Organization invitations. action list, invite, resend, remove. Writes need confirm.",
    invitationsInput,
    WRITE_DESTRUCTIVE,
    (args) => invitations(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_projects_list",
    "List projects visible to the current user. GET .../projects. Optional page and archived.",
    projectsListInput,
    READ_ONLY_REMOTE,
    (args) => projectsList(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_project_get",
    "Get one project. GET .../projects/{project}.",
    projectGetInput,
    READ_ONLY_REMOTE,
    (args) => projectGet(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_project_create",
    "Create a project. POST .../projects. name, color, is_billable, and client_id are required. estimated_time is the project estimate in seconds. Omit confirm for a dry-run.",
    projectCreateInput,
    WRITE_NON_IDEMPOTENT,
    (args) => projectCreate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_project_update",
    "Update a project. PUT .../projects/{project}. Billable rate changes can reprice past entries. Omit confirm for a dry-run.",
    projectUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => projectUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_project_delete",
    "Delete a project. DELETE .../projects/{project}. Irreversible. Omit confirm for a dry-run.",
    projectDeleteInput,
    WRITE_DESTRUCTIVE,
    (args) => projectDelete(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_project_members",
    "Project members. action list, create, update, delete. Rate fields can reprice past entries. Writes need confirm.",
    projectMembersInput,
    WRITE_DESTRUCTIVE,
    (args) => projectMembers(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_clients",
    "Clients. action list, create, update, delete. Writes need confirm.",
    clientsInput,
    WRITE_DESTRUCTIVE,
    (args) => clients(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_tags",
    "Tags. action list, create, update, delete. Writes need confirm.",
    tagsInput,
    WRITE_DESTRUCTIVE,
    (args) => tags(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_tasks",
    "Tasks. action list, create, update, delete. estimated_time is the task estimate in seconds. Writes need confirm.",
    tasksInput,
    WRITE_DESTRUCTIVE,
    (args) => tasks(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_goals",
    "Time goals. action list, get, create, update, delete. Organization goals need the team goals extension. Writes need confirm.",
    goalsInput,
    WRITE_DESTRUCTIVE,
    (args) => goals(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_list",
    "List time entries. GET .../time-entries. Filter by member, project, client, tag, task, start, end, active, billable, type.",
    timeEntriesListInput,
    READ_ONLY_REMOTE,
    (args) => timeEntriesList(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entry_create",
    "Create a time entry. POST .../time-entries. Omit end to start a timer. member_id is a membership id. Omit confirm for a dry-run.",
    timeEntryCreateInput,
    WRITE_NON_IDEMPOTENT,
    (args) => timeEntryCreate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entry_update",
    "Update a time entry. PUT .../time-entries/{timeEntry}. Set end to stop a running timer. Omit confirm for a dry-run.",
    timeEntryUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => timeEntryUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entry_delete",
    "Delete a time entry. DELETE .../time-entries/{timeEntry}. Irreversible. Omit confirm for a dry-run.",
    timeEntryDeleteInput,
    WRITE_DESTRUCTIVE,
    (args) => timeEntryDelete(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_bulk_update",
    "Update many time entries. PATCH .../time-entries. Irreversible for the listed ids. Omit confirm for a dry-run.",
    timeEntriesBulkUpdateInput,
    WRITE_IDEMPOTENT,
    (args) => timeEntriesBulkUpdate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_bulk_delete",
    "Delete many time entries. DELETE .../time-entries?ids[]. Irreversible. Omit confirm for a dry-run.",
    timeEntriesBulkDeleteInput,
    WRITE_DESTRUCTIVE,
    (args) => timeEntriesBulkDelete(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_export",
    "Export time entries. GET .../time-entries/export. format csv, pdf, xlsx, or ods. start and end required by the API.",
    timeEntriesExportInput,
    READ_ONLY_REMOTE,
    (args) => timeEntriesExport(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_aggregate",
    "Aggregate time entries. GET .../time-entries/aggregate. Optional group and sub_group.",
    timeEntriesAggregateInput,
    READ_ONLY_REMOTE,
    (args) => timeEntriesAggregate(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_time_entries_aggregate_export",
    "Export aggregated time entries. GET .../time-entries/aggregate/export. format, group, sub_group, history_group, start, and end required.",
    timeEntriesAggregateExportInput,
    READ_ONLY_REMOTE,
    (args) => timeEntriesAggregateExport(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_timer_active",
    "Get the active timer of the authenticated user. GET /api/v1/users/me/time-entries/active.",
    timerActiveInput,
    READ_ONLY_REMOTE,
    () => timerActive(runtime),
  );
  publish(
    server,
    ctx,
    "solidtime_timer_start",
    "Start a timer by creating a time entry with end=null. POST .../time-entries. Omit confirm for a dry-run.",
    timerStartInput,
    WRITE_NON_IDEMPOTENT,
    (args) => timerStart(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_timer_stop",
    "Stop a running timer by setting end. PUT .../time-entries/{timeEntry}. Defaults to the active entry. Omit confirm for a dry-run.",
    timerStopInput,
    WRITE_IDEMPOTENT,
    (args) => timerStop(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_reports",
    "Saved reports. action list, get, create, update, delete. Public share uses is_public. Writes need confirm.",
    reportsInput,
    WRITE_DESTRUCTIVE,
    (args) => reports(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_public_report",
    "Get a public report by share secret. GET /api/v1/public/reports with X-Api-Key set to the hash fragment of shareable_link. Auth is optional.",
    publicReportInput,
    READ_ONLY_REMOTE,
    (args) => publicReport(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_charts",
    "Dashboard charts. action weekly_project_overview, latest_tasks, last_seven_days, latest_team_activity, daily_tracked_hours, total_weekly_time, total_weekly_billable_time, total_weekly_billable_amount, weekly_history.",
    chartsInput,
    READ_ONLY_REMOTE,
    (args) => charts(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_importers",
    "List available importers. GET .../importers.",
    importersInput,
    READ_ONLY_REMOTE,
    (args) => importers(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_import",
    "Import data into the organization. POST .../import. Omit confirm for a dry-run.",
    importInput,
    WRITE_NON_IDEMPOTENT,
    (args) => importData(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_export_organization",
    "Export organization data. POST .../export. Omit confirm for a dry-run.",
    exportOrganizationInput,
    WRITE_NON_IDEMPOTENT,
    (args) => exportOrganization(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_invoice_settings",
    "Invoice settings. action get or update. Professional feature. Missing plans return a clean not-available error. Writes need confirm.",
    invoiceSettingsInput,
    WRITE_IDEMPOTENT,
    (args) => invoiceSettings(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_invoice_recipients",
    "Invoice recipients. action list, get, create, update, delete, duplicate. Professional feature. Writes need confirm.",
    invoiceRecipientsInput,
    WRITE_DESTRUCTIVE,
    (args) => invoiceRecipients(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_invoices",
    "Invoices. action list, get, create, update, delete, copy, download, download_e_invoice. Professional feature. Writes need confirm.",
    invoicesInput,
    WRITE_DESTRUCTIVE,
    (args) => invoices(runtime, args),
  );
  publish(
    server,
    ctx,
    "solidtime_cancel_trial",
    "Cancel the organization trial. POST .../trial/cancel. Omit confirm for a dry-run.",
    cancelTrialInput,
    WRITE_NON_IDEMPOTENT,
    (args) => cancelTrial(runtime, args),
  );

  return server;
}
