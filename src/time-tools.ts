import { z } from "zod";
import { callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  aggregationIntervalField,
  aggregationTypeField,
  BULK_WARNING,
  confirmField,
  DELETE_WARNING,
  exportFormatField,
  idList,
  idString,
  isoUtc,
  organizationIdField,
  roundingTypeField,
  tagMatchTypeField,
  timeEntryTypeField,
} from "./fields.js";
import { definedBody, definedQuery } from "./json.js";
import { resolveOrganizationId } from "./org.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

const timeFilters = {
  member_id: idString.optional(),
  member_ids: idList.optional(),
  client_ids: z.array(idString).max(500).optional(),
  project_ids: z.array(idString).max(500).optional(),
  tag_ids: z.array(idString).max(500).optional(),
  tag_match_type: tagMatchTypeField.optional(),
  task_ids: z.array(idString).max(500).optional(),
  start: isoUtc.optional(),
  end: isoUtc.optional(),
  active: z.enum(["true", "false"]).optional(),
  billable: z.enum(["true", "false"]).optional(),
  type: timeEntryTypeField.optional(),
};

function filterQuery(args: {
  member_id?: string | undefined;
  member_ids?: string[] | undefined;
  client_ids?: string[] | undefined;
  project_ids?: string[] | undefined;
  tag_ids?: string[] | undefined;
  tag_match_type?: "contains" | "not_contains" | undefined;
  task_ids?: string[] | undefined;
  start?: string | undefined;
  end?: string | undefined;
  active?: string | undefined;
  billable?: string | undefined;
  type?: "work" | "break" | undefined;
}): Record<string, string | number | boolean | readonly (string | number | boolean)[]> {
  const query = definedQuery({
    member_id: args.member_id,
    "member_ids[]": args.member_ids,
    "client_ids[]": args.client_ids,
    "project_ids[]": args.project_ids,
    "tag_ids[]": args.tag_ids,
    tag_match_type: args.tag_match_type,
    "task_ids[]": args.task_ids,
    start: args.start,
    end: args.end,
    active: args.active,
    billable: args.billable,
    type: args.type,
  });
  return query ?? {};
}

export const timeEntriesListInput = z.object({
  organization_id: organizationIdField,
  ...timeFilters,
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
  only_full_dates: z.enum(["true", "false"]).optional(),
  rounding_type: roundingTypeField.optional(),
  rounding_minutes: z.number().int().min(1).max(60).nullable().optional(),
});

export const timeEntryCreateInput = z.object({
  organization_id: organizationIdField,
  member_id: idString.describe("Organization member UUID, not the user UUID."),
  start: isoUtc,
  billable: z.boolean(),
  project_id: idString.nullable().optional(),
  task_id: idString.nullable().optional(),
  end: isoUtc.nullable().optional(),
  type: timeEntryTypeField.optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(idString).max(100).nullable().optional(),
  confirm: confirmField,
});

export const timeEntryUpdateInput = z.object({
  organization_id: organizationIdField,
  time_entry_id: idString,
  member_id: idString.optional(),
  project_id: idString.nullable().optional(),
  task_id: idString.nullable().optional(),
  start: isoUtc.optional(),
  end: isoUtc.nullable().optional(),
  billable: z.boolean().optional(),
  type: timeEntryTypeField.optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(idString).max(100).nullable().optional(),
  confirm: confirmField,
});

export const timeEntryDeleteInput = z.object({
  organization_id: organizationIdField,
  time_entry_id: idString,
  confirm: confirmField,
});

export const timeEntriesBulkUpdateInput = z.object({
  organization_id: organizationIdField,
  ids: idList,
  member_id: idString.optional(),
  project_id: idString.nullable().optional(),
  task_id: idString.nullable().optional(),
  billable: z.boolean().optional(),
  type: timeEntryTypeField.optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(idString).max(100).nullable().optional(),
  confirm: confirmField,
});

export const timeEntriesBulkDeleteInput = z.object({
  organization_id: organizationIdField,
  ids: idList,
  confirm: confirmField,
});

export const timeEntriesExportInput = z.object({
  organization_id: organizationIdField,
  format: exportFormatField,
  ...timeFilters,
  limit: z.number().int().min(1).optional(),
  only_full_dates: z.enum(["true", "false"]).optional(),
  rounding_type: roundingTypeField.optional(),
  rounding_minutes: z.number().int().min(1).max(60).nullable().optional(),
});

export const timeEntriesAggregateInput = z.object({
  organization_id: organizationIdField,
  group: aggregationTypeField.optional(),
  sub_group: aggregationTypeField.optional(),
  fill_gaps_in_time_groups: z.enum(["true", "false"]).optional(),
  ...timeFilters,
  rounding_type: roundingTypeField.optional(),
  rounding_minutes: z.number().int().min(1).max(60).nullable().optional(),
});

export const timeEntriesAggregateExportInput = z.object({
  organization_id: organizationIdField,
  format: exportFormatField,
  group: aggregationTypeField,
  sub_group: aggregationTypeField,
  history_group: aggregationIntervalField,
  fill_gaps_in_time_groups: z.enum(["true", "false"]).optional(),
  ...timeFilters,
  rounding_type: roundingTypeField.optional(),
  rounding_minutes: z.number().int().min(1).max(60).nullable().optional(),
});

export const timerActiveInput = z.object({});
export const timerStartInput = z.object({
  organization_id: organizationIdField,
  member_id: idString,
  start: isoUtc.optional().describe("Defaults to now in UTC."),
  billable: z.boolean(),
  project_id: idString.nullable().optional(),
  task_id: idString.nullable().optional(),
  type: timeEntryTypeField.optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(idString).max(100).nullable().optional(),
  confirm: confirmField,
});
export const timerStopInput = z.object({
  organization_id: organizationIdField,
  time_entry_id: idString
    .optional()
    .describe("Defaults to the active timer from GET /users/me/time-entries/active."),
  end: isoUtc.optional().describe("Defaults to now in UTC."),
  confirm: confirmField,
});

async function orgId(runtime: Runtime, organizationId: string | undefined): Promise<string> {
  return resolveOrganizationId(runtime, organizationId);
}

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function entryIdFrom(payload: Record<string, unknown>): string | undefined {
  const data = payload["data"];
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    const id = nested["id"];
    if (typeof id === "string") return id;
  }
  if (typeof payload["id"] === "string") return payload["id"];
  return undefined;
}

export async function timeEntriesList(
  runtime: Runtime,
  args: z.output<typeof timeEntriesListInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_list", undefined), {
    params: { organization },
    query: definedQuery({
      ...filterQuery(args),
      limit: args.limit,
      offset: args.offset,
      only_full_dates: args.only_full_dates,
      rounding_type: args.rounding_type,
      rounding_minutes: args.rounding_minutes ?? undefined,
    }),
  });
}

export async function timeEntryCreate(
  runtime: Runtime,
  args: z.output<typeof timeEntryCreateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entry_create", undefined), {
    params: { organization },
    body: definedBody({
      member_id: args.member_id,
      start: args.start,
      billable: args.billable,
      project_id: args.project_id,
      task_id: args.task_id,
      end: args.end,
      type: args.type,
      description: args.description,
      tags: args.tags,
    }),
    confirm: args.confirm,
    summary:
      args.end === null || args.end === undefined ? "Start a timer." : "Create a time entry.",
  });
}

export async function timeEntryUpdate(
  runtime: Runtime,
  args: z.output<typeof timeEntryUpdateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entry_update", undefined), {
    params: { organization, timeEntry: args.time_entry_id },
    body: definedBody({
      member_id: args.member_id,
      project_id: args.project_id,
      task_id: args.task_id,
      start: args.start,
      end: args.end,
      billable: args.billable,
      type: args.type,
      description: args.description,
      tags: args.tags,
    }),
    confirm: args.confirm,
    summary: "Update a time entry.",
  });
}

export async function timeEntryDelete(
  runtime: Runtime,
  args: z.output<typeof timeEntryDeleteInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entry_delete", undefined), {
    params: { organization, timeEntry: args.time_entry_id },
    confirm: args.confirm,
    summary: "Delete a time entry.",
    warnings: [DELETE_WARNING],
  });
}

export async function timeEntriesBulkUpdate(
  runtime: Runtime,
  args: z.output<typeof timeEntriesBulkUpdateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_bulk_update", undefined), {
    params: { organization },
    body: {
      ids: args.ids,
      changes: definedBody({
        member_id: args.member_id,
        project_id: args.project_id,
        task_id: args.task_id,
        billable: args.billable,
        type: args.type,
        description: args.description,
        tags: args.tags,
      }),
    },
    confirm: args.confirm,
    summary: `Update ${args.ids.length} time entries.`,
    warnings: [BULK_WARNING],
  });
}

export async function timeEntriesBulkDelete(
  runtime: Runtime,
  args: z.output<typeof timeEntriesBulkDeleteInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_bulk_delete", undefined), {
    params: { organization },
    query: definedQuery({ "ids[]": args.ids }),
    confirm: args.confirm,
    summary: `Delete ${args.ids.length} time entries.`,
    warnings: [BULK_WARNING, DELETE_WARNING],
  });
}

export async function timeEntriesExport(
  runtime: Runtime,
  args: z.output<typeof timeEntriesExportInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_export", undefined), {
    params: { organization },
    query: definedQuery({
      format: args.format,
      ...filterQuery(args),
      limit: args.limit,
      only_full_dates: args.only_full_dates,
      rounding_type: args.rounding_type,
      rounding_minutes: args.rounding_minutes ?? undefined,
    }),
  });
}

export async function timeEntriesAggregate(
  runtime: Runtime,
  args: z.output<typeof timeEntriesAggregateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_aggregate", undefined), {
    params: { organization },
    query: definedQuery({
      group: args.group,
      sub_group: args.sub_group,
      fill_gaps_in_time_groups: args.fill_gaps_in_time_groups,
      ...filterQuery(args),
      rounding_type: args.rounding_type,
      rounding_minutes: args.rounding_minutes ?? undefined,
    }),
  });
}

export async function timeEntriesAggregateExport(
  runtime: Runtime,
  args: z.output<typeof timeEntriesAggregateExportInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entries_aggregate_export", undefined), {
    params: { organization },
    query: definedQuery({
      format: args.format,
      group: args.group,
      sub_group: args.sub_group,
      history_group: args.history_group,
      fill_gaps_in_time_groups: args.fill_gaps_in_time_groups,
      ...filterQuery(args),
      rounding_type: args.rounding_type,
      rounding_minutes: args.rounding_minutes ?? undefined,
    }),
  });
}

export async function timerActive(runtime: Runtime): Promise<Record<string, unknown>> {
  try {
    return await callSolidtime(runtime, requireOp("solidtime_timer_active", undefined));
  } catch (error) {
    if (
      error instanceof ConnectorError &&
      error.code === "not_found" &&
      /No active time entry/i.test(error.message)
    ) {
      return { data: null, active: false };
    }
    throw error;
  }
}

export async function timerStart(
  runtime: Runtime,
  args: z.output<typeof timerStartInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_time_entry_create", undefined), {
    params: { organization },
    body: definedBody({
      member_id: args.member_id,
      start: args.start ?? nowUtc(),
      billable: args.billable,
      project_id: args.project_id,
      task_id: args.task_id,
      end: null,
      type: args.type,
      description: args.description,
      tags: args.tags,
    }),
    confirm: args.confirm,
    summary: "Start a running timer (time entry with end=null).",
  });
}

export async function timerStop(
  runtime: Runtime,
  args: z.output<typeof timerStopInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  let timeEntryId = args.time_entry_id;
  if (timeEntryId === undefined) {
    const active = await callSolidtime(runtime, requireOp("solidtime_timer_active", undefined));
    timeEntryId = entryIdFrom(active);
    if (timeEntryId === undefined) {
      throw new ConnectorError("not_found", "No active timer to stop.");
    }
  }
  return callSolidtime(runtime, requireOp("solidtime_time_entry_update", undefined), {
    params: { organization, timeEntry: timeEntryId },
    body: { end: args.end ?? nowUtc() },
    confirm: args.confirm,
    summary: "Stop a running timer.",
  });
}
