import { z } from "zod";
import { callProfessional, callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  aggregationIntervalField,
  aggregationTypeField,
  confirmField,
  DELETE_WARNING,
  idString,
  isoUtc,
  organizationIdField,
  roundingTypeField,
  tagMatchTypeField,
  weekdayField,
} from "./fields.js";
import { definedBody } from "./json.js";
import { resolveOrganizationId } from "./org.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

const chartActions = [
  "weekly_project_overview",
  "latest_tasks",
  "last_seven_days",
  "latest_team_activity",
  "daily_tracked_hours",
  "total_weekly_time",
  "total_weekly_billable_time",
  "total_weekly_billable_amount",
  "weekly_history",
] as const;

export const reportsInput = z.object({
  action: z.enum(["list", "get", "create", "update", "delete"]),
  organization_id: organizationIdField,
  report_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  is_public: z.boolean().optional(),
  public_until: isoUtc.nullable().optional(),
  properties_start: isoUtc.optional(),
  properties_end: isoUtc.optional(),
  properties_group: aggregationTypeField.optional(),
  properties_sub_group: aggregationTypeField.optional(),
  properties_history_group: aggregationIntervalField.optional(),
  properties_member_ids: z.array(idString).optional(),
  properties_project_ids: z.array(idString).optional(),
  properties_client_ids: z.array(idString).optional(),
  properties_tag_ids: z.array(idString).optional(),
  properties_task_ids: z.array(idString).optional(),
  properties_billable: z.boolean().nullable().optional(),
  properties_active: z.boolean().nullable().optional(),
  properties_tag_match_type: tagMatchTypeField.optional(),
  properties_week_start: weekdayField.optional(),
  properties_timezone: z.string().max(64).nullable().optional(),
  properties_rounding_type: roundingTypeField.optional(),
  properties_rounding_minutes: z.number().int().min(1).max(60).nullable().optional(),
  confirm: confirmField,
});

export const publicReportInput = z.object({
  share: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe(
      "Public share secret. Use the hash fragment of shareable_link (the part after #). Sent as X-Api-Key.",
    ),
});

export const chartsInput = z.object({
  action: z.enum(chartActions),
  organization_id: organizationIdField,
});

export const importersInput = z.object({ organization_id: organizationIdField });
export const importInput = z.object({
  organization_id: organizationIdField,
  type: z.string().trim().min(1).max(64).describe("Importer type from solidtime_importers."),
  data: z
    .string()
    .min(1)
    .max(1_000_000)
    .describe("Import payload. Keep under 1MB in this connector."),
  confirm: confirmField,
});
export const exportOrganizationInput = z.object({
  organization_id: organizationIdField,
  confirm: confirmField,
});
export const cancelTrialInput = z.object({
  organization_id: organizationIdField,
  confirm: confirmField,
});

async function orgId(runtime: Runtime, organizationId: string | undefined): Promise<string> {
  return resolveOrganizationId(runtime, organizationId);
}

export async function reports(
  runtime: Runtime,
  args: z.output<typeof reportsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_reports", "list"), {
      params: { organization },
    });
  }
  if (args.action === "create") {
    if (
      args.name === undefined ||
      args.is_public === undefined ||
      args.properties_start === undefined ||
      args.properties_end === undefined ||
      args.properties_group === undefined ||
      args.properties_sub_group === undefined ||
      args.properties_history_group === undefined
    ) {
      throw new ConnectorError(
        "input",
        "name, is_public, properties_start, properties_end, properties_group, properties_sub_group, and properties_history_group are required.",
      );
    }
    return callSolidtime(runtime, requireOp("solidtime_reports", "create"), {
      params: { organization },
      body: definedBody({
        name: args.name,
        description: args.description,
        is_public: args.is_public,
        public_until: args.public_until,
        properties: definedBody({
          start: args.properties_start,
          end: args.properties_end,
          group: args.properties_group,
          sub_group: args.properties_sub_group,
          history_group: args.properties_history_group,
          member_ids: args.properties_member_ids,
          project_ids: args.properties_project_ids,
          client_ids: args.properties_client_ids,
          tag_ids: args.properties_tag_ids,
          task_ids: args.properties_task_ids,
          billable: args.properties_billable,
          active: args.properties_active,
          tag_match_type: args.properties_tag_match_type,
          week_start: args.properties_week_start,
          timezone: args.properties_timezone,
          rounding_type: args.properties_rounding_type,
          rounding_minutes: args.properties_rounding_minutes,
        }),
      }),
      confirm: args.confirm,
      summary: `Create report ${args.name}.`,
    });
  }
  if (args.report_id === undefined) throw new ConnectorError("input", "report_id is required.");
  if (args.action === "get") {
    return callSolidtime(runtime, requireOp("solidtime_reports", "get"), {
      params: { organization, report: args.report_id },
    });
  }
  if (args.action === "update") {
    return callSolidtime(runtime, requireOp("solidtime_reports", "update"), {
      params: { organization, report: args.report_id },
      body: definedBody({
        name: args.name,
        description: args.description,
        is_public: args.is_public,
        public_until: args.public_until,
      }),
      confirm: args.confirm,
      summary: "Update a report.",
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_reports", "delete"), {
    params: { organization, report: args.report_id },
    confirm: args.confirm,
    summary: "Delete a report.",
    warnings: [DELETE_WARNING],
  });
}

export async function publicReport(
  runtime: Runtime,
  args: z.output<typeof publicReportInput>,
): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_public_report", undefined), {
    extraHeaders: { "X-Api-Key": args.share },
    optionalAuth: true,
  });
}

export async function charts(
  runtime: Runtime,
  args: z.output<typeof chartsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_charts", args.action), {
    params: { organization },
  });
}

export async function importers(
  runtime: Runtime,
  args: z.output<typeof importersInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_importers", undefined), {
    params: { organization },
  });
}

export async function importData(
  runtime: Runtime,
  args: z.output<typeof importInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_import", undefined), {
    params: { organization },
    body: { type: args.type, data: args.data },
    confirm: args.confirm,
    summary: `Import ${args.type} data.`,
  });
}

export async function exportOrganization(
  runtime: Runtime,
  args: z.output<typeof exportOrganizationInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_export_organization", undefined), {
    params: { organization },
    confirm: args.confirm,
    summary: "Export organization data.",
  });
}

export async function cancelTrial(
  runtime: Runtime,
  args: z.output<typeof cancelTrialInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callProfessional(runtime, requireOp("solidtime_cancel_trial", undefined), {
    params: { organization },
    confirm: args.confirm,
    summary: "Cancel the organization trial.",
  });
}
