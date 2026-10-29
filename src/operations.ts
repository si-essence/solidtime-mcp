/** Every Solidtime public API v1 operation this connector covers. One row per path+method. */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ResponseKind = "json" | "text";
export type Catalog = "openapi" | "client";

export interface Operation {
  readonly method: HttpMethod;
  readonly path: string;
  readonly tool: string;
  readonly action: string | undefined;
  readonly write: boolean;
  readonly destructive: boolean;
  readonly kind: ResponseKind;
  readonly summary: string;
  readonly catalog: Catalog;
  readonly rateSensitive: boolean;
}

function row(
  method: HttpMethod,
  path: string,
  tool: string,
  options: {
    action?: string;
    write?: boolean;
    destructive?: boolean;
    kind?: ResponseKind;
    summary: string;
    catalog?: Catalog;
    rateSensitive?: boolean;
  },
): Operation {
  const write =
    options.write === true ||
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE";
  return {
    method,
    path,
    tool,
    action: options.action,
    write,
    destructive: options.destructive === true,
    kind: options.kind ?? "json",
    summary: options.summary,
    catalog: options.catalog ?? "openapi",
    rateSensitive: options.rateSensitive === true,
  };
}

export const EXTRA_TOOLS: readonly string[] = ["solidtime_timer_start", "solidtime_timer_stop"];

export const OPERATIONS: readonly Operation[] = [
  row("GET", "/v1/users/me", "solidtime_me", {
    write: false,
    summary: "Get the authenticated user.",
  }),
  row("GET", "/v1/users/me/memberships", "solidtime_memberships", {
    write: false,
    summary: "List memberships of the authenticated user.",
  }),
  row("PUT", "/v1/users/{user}", "solidtime_user_update", {
    summary: "Update the authenticated user.",
  }),
  row("PUT", "/v1/users/me/current-organization", "solidtime_user_set_organization", {
    summary: "Set the current organization of the authenticated user.",
  }),
  row("DELETE", "/v1/users/{user}", "solidtime_user_delete", {
    destructive: true,
    summary: "Delete the authenticated user.",
  }),
  row("POST", "/v1/users/{user}/resend-email-verification", "solidtime_user_email", {
    action: "resend_verification",
    summary: "Resend the pending email update verification email.",
  }),
  row("POST", "/v1/users/{user}/reset-pending-email", "solidtime_user_email", {
    action: "reset_pending",
    summary: "Reset the pending email for a user.",
  }),
  row("GET", "/v1/users/me/api-tokens", "solidtime_api_tokens", {
    action: "list",
    write: false,
    summary: "List API tokens of the authenticated user.",
  }),
  row("POST", "/v1/users/me/api-tokens", "solidtime_api_tokens", {
    action: "create",
    summary: "Create an API token for the authenticated user.",
  }),
  row("POST", "/v1/users/me/api-tokens/{apiToken}/revoke", "solidtime_api_tokens", {
    action: "revoke",
    summary: "Revoke an API token.",
  }),
  row("DELETE", "/v1/users/me/api-tokens/{apiToken}", "solidtime_api_tokens", {
    action: "delete",
    destructive: true,
    summary: "Delete an API token.",
  }),
  row("GET", "/v1/currencies", "solidtime_currencies", {
    write: false,
    summary: "List currencies.",
  }),
  row("GET", "/v1/time-zones", "solidtime_time_zones", {
    write: false,
    summary: "List time zones.",
  }),
  row("GET", "/v1/countries", "solidtime_countries", {
    write: false,
    catalog: "client",
    summary: "List countries.",
  }),
  row("POST", "/v1/organizations", "solidtime_organization_create", {
    summary: "Create an organization.",
  }),
  row("GET", "/v1/organizations/{organization}", "solidtime_organization_get", {
    write: false,
    summary: "Get an organization.",
  }),
  row("PUT", "/v1/organizations/{organization}", "solidtime_organization_update", {
    rateSensitive: true,
    summary: "Update an organization. Billable rate changes reprice past entries.",
  }),
  row("DELETE", "/v1/organizations/{organization}", "solidtime_organization_delete", {
    destructive: true,
    summary: "Delete an organization.",
  }),
  row(
    "GET",
    "/v1/organizations/{organization}/charts/weekly-project-overview",
    "solidtime_charts",
    {
      action: "weekly_project_overview",
      write: false,
      summary: "Weekly project overview chart.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/charts/latest-tasks", "solidtime_charts", {
    action: "latest_tasks",
    write: false,
    summary: "Latest tasks chart.",
  }),
  row("GET", "/v1/organizations/{organization}/charts/last-seven-days", "solidtime_charts", {
    action: "last_seven_days",
    write: false,
    summary: "Last seven days chart.",
  }),
  row("GET", "/v1/organizations/{organization}/charts/latest-team-activity", "solidtime_charts", {
    action: "latest_team_activity",
    write: false,
    summary: "Latest team activity chart.",
  }),
  row("GET", "/v1/organizations/{organization}/charts/daily-tracked-hours", "solidtime_charts", {
    action: "daily_tracked_hours",
    write: false,
    summary: "Daily tracked hours chart.",
  }),
  row("GET", "/v1/organizations/{organization}/charts/total-weekly-time", "solidtime_charts", {
    action: "total_weekly_time",
    write: false,
    summary: "Total weekly time chart.",
  }),
  row(
    "GET",
    "/v1/organizations/{organization}/charts/total-weekly-billable-time",
    "solidtime_charts",
    {
      action: "total_weekly_billable_time",
      write: false,
      summary: "Total weekly billable time chart.",
    },
  ),
  row(
    "GET",
    "/v1/organizations/{organization}/charts/total-weekly-billable-amount",
    "solidtime_charts",
    {
      action: "total_weekly_billable_amount",
      write: false,
      summary: "Total weekly billable amount chart.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/charts/weekly-history", "solidtime_charts", {
    action: "weekly_history",
    write: false,
    summary: "Weekly history chart.",
  }),
  row("GET", "/v1/organizations/{organization}/clients", "solidtime_clients", {
    action: "list",
    write: false,
    summary: "List clients.",
  }),
  row("POST", "/v1/organizations/{organization}/clients", "solidtime_clients", {
    action: "create",
    summary: "Create a client.",
  }),
  row("PUT", "/v1/organizations/{organization}/clients/{client}", "solidtime_clients", {
    action: "update",
    summary: "Update a client.",
  }),
  row("DELETE", "/v1/organizations/{organization}/clients/{client}", "solidtime_clients", {
    action: "delete",
    destructive: true,
    summary: "Delete a client.",
  }),
  row("POST", "/v1/organizations/{organization}/export", "solidtime_export_organization", {
    summary: "Export organization data.",
  }),
  row("GET", "/v1/organizations/{organization}/importers", "solidtime_importers", {
    write: false,
    summary: "List available importers.",
  }),
  row("POST", "/v1/organizations/{organization}/import", "solidtime_import", {
    summary: "Import data into the organization.",
  }),
  row("GET", "/v1/organizations/{organization}/invitations", "solidtime_invitations", {
    action: "list",
    write: false,
    summary: "List invitations.",
  }),
  row("POST", "/v1/organizations/{organization}/invitations", "solidtime_invitations", {
    action: "invite",
    summary: "Invite a user to the organization.",
  }),
  row(
    "POST",
    "/v1/organizations/{organization}/invitations/{invitation}/resend",
    "solidtime_invitations",
    {
      action: "resend",
      summary: "Resend a pending invitation email.",
    },
  ),
  row(
    "DELETE",
    "/v1/organizations/{organization}/invitations/{invitation}",
    "solidtime_invitations",
    {
      action: "remove",
      destructive: true,
      summary: "Remove a pending invitation.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/members", "solidtime_members_list", {
    write: false,
    summary: "List organization members.",
  }),
  row("PUT", "/v1/organizations/{organization}/members/{member}", "solidtime_member_update", {
    rateSensitive: true,
    summary: "Update a member. Billable rate changes reprice past entries.",
  }),
  row("DELETE", "/v1/organizations/{organization}/members/{member}", "solidtime_member_remove", {
    destructive: true,
    summary: "Remove a member.",
  }),
  row(
    "POST",
    "/v1/organizations/{organization}/members/{member}/invite-placeholder",
    "solidtime_member_invite_placeholder",
    {
      summary: "Invite a placeholder member to become a real member.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/members/{member}/make-placeholder",
    "solidtime_member_make_placeholder",
    {
      summary: "Turn a member into a placeholder.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/member/{member}/merge-into",
    "solidtime_member_merge",
    {
      destructive: true,
      summary: "Merge one member into another.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/projects", "solidtime_projects_list", {
    write: false,
    summary: "List projects visible to the current user.",
  }),
  row("POST", "/v1/organizations/{organization}/projects", "solidtime_project_create", {
    rateSensitive: true,
    summary: "Create a project.",
  }),
  row("GET", "/v1/organizations/{organization}/projects/{project}", "solidtime_project_get", {
    write: false,
    summary: "Get a project.",
  }),
  row("PUT", "/v1/organizations/{organization}/projects/{project}", "solidtime_project_update", {
    rateSensitive: true,
    summary: "Update a project. Billable rate changes reprice past entries.",
  }),
  row("DELETE", "/v1/organizations/{organization}/projects/{project}", "solidtime_project_delete", {
    destructive: true,
    summary: "Delete a project.",
  }),
  row(
    "GET",
    "/v1/organizations/{organization}/projects/{project}/project-members",
    "solidtime_project_members",
    {
      action: "list",
      write: false,
      summary: "List project members.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/projects/{project}/project-members",
    "solidtime_project_members",
    {
      action: "create",
      rateSensitive: true,
      summary: "Add a project member.",
    },
  ),
  row(
    "PUT",
    "/v1/organizations/{organization}/project-members/{projectMember}",
    "solidtime_project_members",
    {
      action: "update",
      rateSensitive: true,
      summary: "Update a project member billable rate.",
    },
  ),
  row(
    "DELETE",
    "/v1/organizations/{organization}/project-members/{projectMember}",
    "solidtime_project_members",
    {
      action: "delete",
      destructive: true,
      summary: "Remove a project member.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/goals", "solidtime_goals", {
    action: "list",
    write: false,
    summary: "List goals.",
  }),
  row("POST", "/v1/organizations/{organization}/goals", "solidtime_goals", {
    action: "create",
    summary: "Create a goal.",
  }),
  row("GET", "/v1/organizations/{organization}/goals/{goal}", "solidtime_goals", {
    action: "get",
    write: false,
    summary: "Get a goal.",
  }),
  row("PUT", "/v1/organizations/{organization}/goals/{goal}", "solidtime_goals", {
    action: "update",
    summary: "Update a goal.",
  }),
  row("DELETE", "/v1/organizations/{organization}/goals/{goal}", "solidtime_goals", {
    action: "delete",
    destructive: true,
    summary: "Delete a goal.",
  }),
  row("GET", "/v1/organizations/{organization}/reports", "solidtime_reports", {
    action: "list",
    write: false,
    summary: "List reports.",
  }),
  row("POST", "/v1/organizations/{organization}/reports", "solidtime_reports", {
    action: "create",
    summary: "Create a report.",
  }),
  row("GET", "/v1/organizations/{organization}/reports/{report}", "solidtime_reports", {
    action: "get",
    write: false,
    summary: "Get a report.",
  }),
  row("PUT", "/v1/organizations/{organization}/reports/{report}", "solidtime_reports", {
    action: "update",
    summary: "Update a report.",
  }),
  row("DELETE", "/v1/organizations/{organization}/reports/{report}", "solidtime_reports", {
    action: "delete",
    destructive: true,
    summary: "Delete a report.",
  }),
  row("GET", "/v1/public/reports", "solidtime_public_report", {
    write: false,
    summary: "Get a public report by share secret.",
  }),
  row("GET", "/v1/organizations/{organization}/tags", "solidtime_tags", {
    action: "list",
    write: false,
    summary: "List tags.",
  }),
  row("POST", "/v1/organizations/{organization}/tags", "solidtime_tags", {
    action: "create",
    summary: "Create a tag.",
  }),
  row("PUT", "/v1/organizations/{organization}/tags/{tag}", "solidtime_tags", {
    action: "update",
    summary: "Update a tag.",
  }),
  row("DELETE", "/v1/organizations/{organization}/tags/{tag}", "solidtime_tags", {
    action: "delete",
    destructive: true,
    summary: "Delete a tag.",
  }),
  row("GET", "/v1/organizations/{organization}/tasks", "solidtime_tasks", {
    action: "list",
    write: false,
    summary: "List tasks.",
  }),
  row("POST", "/v1/organizations/{organization}/tasks", "solidtime_tasks", {
    action: "create",
    summary: "Create a task.",
  }),
  row("PUT", "/v1/organizations/{organization}/tasks/{task}", "solidtime_tasks", {
    action: "update",
    summary: "Update a task.",
  }),
  row("DELETE", "/v1/organizations/{organization}/tasks/{task}", "solidtime_tasks", {
    action: "delete",
    destructive: true,
    summary: "Delete a task.",
  }),
  row("GET", "/v1/organizations/{organization}/time-entries", "solidtime_time_entries_list", {
    write: false,
    summary: "List time entries.",
  }),
  row("POST", "/v1/organizations/{organization}/time-entries", "solidtime_time_entry_create", {
    summary: "Create a time entry. Omit end to start a timer.",
  }),
  row(
    "PATCH",
    "/v1/organizations/{organization}/time-entries",
    "solidtime_time_entries_bulk_update",
    {
      summary: "Update multiple time entries.",
    },
  ),
  row(
    "DELETE",
    "/v1/organizations/{organization}/time-entries",
    "solidtime_time_entries_bulk_delete",
    {
      destructive: true,
      summary: "Delete multiple time entries.",
    },
  ),
  row(
    "GET",
    "/v1/organizations/{organization}/time-entries/export",
    "solidtime_time_entries_export",
    {
      write: false,
      summary: "Export time entries.",
    },
  ),
  row(
    "GET",
    "/v1/organizations/{organization}/time-entries/aggregate",
    "solidtime_time_entries_aggregate",
    {
      write: false,
      summary: "Aggregate time entries.",
    },
  ),
  row(
    "GET",
    "/v1/organizations/{organization}/time-entries/aggregate/export",
    "solidtime_time_entries_aggregate_export",
    {
      write: false,
      summary: "Export aggregated time entries.",
    },
  ),
  row(
    "PUT",
    "/v1/organizations/{organization}/time-entries/{timeEntry}",
    "solidtime_time_entry_update",
    {
      summary: "Update a time entry. Set end to stop a running timer.",
    },
  ),
  row(
    "DELETE",
    "/v1/organizations/{organization}/time-entries/{timeEntry}",
    "solidtime_time_entry_delete",
    {
      destructive: true,
      summary: "Delete a time entry.",
    },
  ),
  row("GET", "/v1/users/me/time-entries/active", "solidtime_timer_active", {
    write: false,
    summary: "Get the active time entry of the authenticated user.",
  }),
  row("GET", "/v1/organizations/{organization}/invoice-settings", "solidtime_invoice_settings", {
    action: "get",
    write: false,
    catalog: "client",
    summary: "Get invoice settings. Professional feature.",
  }),
  row("PUT", "/v1/organizations/{organization}/invoice-settings", "solidtime_invoice_settings", {
    action: "update",
    catalog: "client",
    summary: "Update invoice settings. Professional feature.",
  }),
  row(
    "GET",
    "/v1/organizations/{organization}/invoice-recipients",
    "solidtime_invoice_recipients",
    {
      action: "list",
      write: false,
      catalog: "client",
      summary: "List invoice recipients. Professional feature.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/invoice-recipients",
    "solidtime_invoice_recipients",
    {
      action: "create",
      catalog: "client",
      summary: "Create an invoice recipient. Professional feature.",
    },
  ),
  row(
    "GET",
    "/v1/organizations/{organization}/invoice-recipients/{invoiceRecipient}",
    "solidtime_invoice_recipients",
    {
      action: "get",
      write: false,
      catalog: "client",
      summary: "Get an invoice recipient. Professional feature.",
    },
  ),
  row(
    "PUT",
    "/v1/organizations/{organization}/invoice-recipients/{invoiceRecipient}",
    "solidtime_invoice_recipients",
    {
      action: "update",
      catalog: "client",
      summary: "Update an invoice recipient. Professional feature.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/invoice-recipients/{invoiceRecipient}/duplicate",
    "solidtime_invoice_recipients",
    {
      action: "duplicate",
      catalog: "client",
      summary: "Duplicate an invoice recipient. Professional feature.",
    },
  ),
  row(
    "DELETE",
    "/v1/organizations/{organization}/invoice-recipients/{invoiceRecipient}",
    "solidtime_invoice_recipients",
    {
      action: "delete",
      destructive: true,
      catalog: "client",
      summary: "Delete an invoice recipient. Professional feature.",
    },
  ),
  row("GET", "/v1/organizations/{organization}/invoices", "solidtime_invoices", {
    action: "list",
    write: false,
    catalog: "client",
    summary: "List invoices. Professional feature.",
  }),
  row("POST", "/v1/organizations/{organization}/invoices", "solidtime_invoices", {
    action: "create",
    catalog: "client",
    summary: "Create an invoice. Professional feature.",
  }),
  row("POST", "/v1/organizations/{organization}/invoices/{invoice}/copy", "solidtime_invoices", {
    action: "copy",
    catalog: "client",
    summary: "Copy an invoice. Professional feature.",
  }),
  row("GET", "/v1/organizations/{organization}/invoices/{invoice}", "solidtime_invoices", {
    action: "get",
    write: false,
    catalog: "client",
    summary: "Get an invoice. Professional feature.",
  }),
  row("PUT", "/v1/organizations/{organization}/invoices/{invoice}", "solidtime_invoices", {
    action: "update",
    catalog: "client",
    summary: "Update an invoice. Professional feature.",
  }),
  row("DELETE", "/v1/organizations/{organization}/invoices/{invoice}", "solidtime_invoices", {
    action: "delete",
    destructive: true,
    catalog: "client",
    summary: "Delete an invoice. Professional feature.",
  }),
  row(
    "POST",
    "/v1/organizations/{organization}/invoices/{invoice}/download",
    "solidtime_invoices",
    {
      action: "download",
      catalog: "client",
      summary: "Download an invoice PDF. Professional feature.",
    },
  ),
  row(
    "POST",
    "/v1/organizations/{organization}/invoices/{invoice}/download-e-invoice",
    "solidtime_invoices",
    {
      action: "download_e_invoice",
      catalog: "client",
      summary: "Download an e-invoice. Professional feature.",
    },
  ),
  row("POST", "/v1/organizations/{organization}/trial/cancel", "solidtime_cancel_trial", {
    catalog: "client",
    summary: "Cancel the organization trial.",
  }),
];

export function toolNames(): string[] {
  return [...new Set([...OPERATIONS.map((operation) => operation.tool), ...EXTRA_TOOLS])].sort();
}

export function operationsForTool(name: string): Operation[] {
  return OPERATIONS.filter((operation) => operation.tool === name);
}

export function toolIsWrite(name: string): boolean {
  if (EXTRA_TOOLS.includes(name)) return true;
  return OPERATIONS.some((operation) => operation.tool === name && operation.write);
}

export function openApiKeys(): string[] {
  return OPERATIONS.filter((operation) => operation.catalog === "openapi")
    .map((operation) => `${operation.method} ${operation.path}`)
    .sort();
}
