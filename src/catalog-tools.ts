import { z } from "zod";
import { callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  confirmField,
  DELETE_WARNING,
  estimatedSecondsField,
  goalComparisonField,
  goalPeriodField,
  goalTypeField,
  idString,
  organizationIdField,
  weekdayField,
} from "./fields.js";
import { definedBody, definedQuery } from "./json.js";
import { resolveOrganizationId } from "./org.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

export const countriesInput = z.object({});
export const currenciesInput = z.object({});
export const timeZonesInput = z.object({});

export const clientsInput = z.object({
  action: z.enum(["list", "create", "update", "delete"]),
  organization_id: organizationIdField,
  client_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  is_archived: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  archived: z.enum(["true", "false", "all"]).optional(),
  confirm: confirmField,
});

export const tagsInput = z.object({
  action: z.enum(["list", "create", "update", "delete"]),
  organization_id: organizationIdField,
  tag_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  confirm: confirmField,
});

export const tasksInput = z.object({
  action: z.enum(["list", "create", "update", "delete"]),
  organization_id: organizationIdField,
  task_id: idString.optional(),
  project_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  estimated_time: estimatedSecondsField.nullable().optional(),
  is_done: z.boolean().optional(),
  done: z.enum(["true", "false", "all"]).optional(),
  confirm: confirmField,
});

export const goalsInput = z.object({
  action: z.enum(["list", "get", "create", "update", "delete"]),
  organization_id: organizationIdField,
  goal_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  type: goalTypeField.optional(),
  comparison: goalComparisonField.optional(),
  target_seconds: z.number().int().min(1).max(2147483647).optional(),
  period: goalPeriodField.optional(),
  member_id: idString.nullable().optional(),
  timezone: z.string().trim().min(1).max(64).nullable().optional(),
  week_start: weekdayField.nullable().optional(),
  is_archived: z.boolean().optional(),
  confirm: confirmField,
});

async function orgId(runtime: Runtime, organizationId: string | undefined): Promise<string> {
  return resolveOrganizationId(runtime, organizationId);
}

export async function countries(runtime: Runtime): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_countries", undefined));
}

export async function currencies(runtime: Runtime): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_currencies", undefined));
}

export async function timeZones(runtime: Runtime): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_time_zones", undefined));
}

export async function clients(
  runtime: Runtime,
  args: z.output<typeof clientsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_clients", "list"), {
      params: { organization },
      query: definedQuery({ page: args.page, archived: args.archived }),
    });
  }
  if (args.action === "create") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callSolidtime(runtime, requireOp("solidtime_clients", "create"), {
      params: { organization },
      body: { name: args.name },
      confirm: args.confirm,
      summary: `Create client ${args.name}.`,
    });
  }
  if (args.client_id === undefined) throw new ConnectorError("input", "client_id is required.");
  if (args.action === "update") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callSolidtime(runtime, requireOp("solidtime_clients", "update"), {
      params: { organization, client: args.client_id },
      body: definedBody({ name: args.name, is_archived: args.is_archived }),
      confirm: args.confirm,
      summary: "Update a client.",
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_clients", "delete"), {
    params: { organization, client: args.client_id },
    confirm: args.confirm,
    summary: "Delete a client.",
    warnings: [DELETE_WARNING],
  });
}

export async function tags(
  runtime: Runtime,
  args: z.output<typeof tagsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_tags", "list"), {
      params: { organization },
    });
  }
  if (args.action === "create") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callSolidtime(runtime, requireOp("solidtime_tags", "create"), {
      params: { organization },
      body: { name: args.name },
      confirm: args.confirm,
      summary: `Create tag ${args.name}.`,
    });
  }
  if (args.tag_id === undefined) throw new ConnectorError("input", "tag_id is required.");
  if (args.action === "update") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callSolidtime(runtime, requireOp("solidtime_tags", "update"), {
      params: { organization, tag: args.tag_id },
      body: { name: args.name },
      confirm: args.confirm,
      summary: "Update a tag.",
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_tags", "delete"), {
    params: { organization, tag: args.tag_id },
    confirm: args.confirm,
    summary: "Delete a tag.",
    warnings: [DELETE_WARNING],
  });
}

export async function tasks(
  runtime: Runtime,
  args: z.output<typeof tasksInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_tasks", "list"), {
      params: { organization },
      query: definedQuery({ project_id: args.project_id, done: args.done }),
    });
  }
  if (args.action === "create") {
    if (args.name === undefined || args.project_id === undefined) {
      throw new ConnectorError("input", "name and project_id are required.");
    }
    return callSolidtime(runtime, requireOp("solidtime_tasks", "create"), {
      params: { organization },
      body: definedBody({
        name: args.name,
        project_id: args.project_id,
        estimated_time: args.estimated_time,
      }),
      confirm: args.confirm,
      summary: `Create task ${args.name}.`,
    });
  }
  if (args.task_id === undefined) throw new ConnectorError("input", "task_id is required.");
  if (args.action === "update") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callSolidtime(runtime, requireOp("solidtime_tasks", "update"), {
      params: { organization, task: args.task_id },
      body: definedBody({
        name: args.name,
        is_done: args.is_done,
        estimated_time: args.estimated_time,
      }),
      confirm: args.confirm,
      summary: "Update a task.",
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_tasks", "delete"), {
    params: { organization, task: args.task_id },
    confirm: args.confirm,
    summary: "Delete a task.",
    warnings: [DELETE_WARNING],
  });
}

export async function goals(
  runtime: Runtime,
  args: z.output<typeof goalsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_goals", "list"), {
      params: { organization },
    });
  }
  if (args.action === "create") {
    if (
      args.name === undefined ||
      args.type === undefined ||
      args.comparison === undefined ||
      args.target_seconds === undefined ||
      args.period === undefined
    ) {
      throw new ConnectorError(
        "input",
        "name, type, comparison, target_seconds, and period are required.",
      );
    }
    return callSolidtime(runtime, requireOp("solidtime_goals", "create"), {
      params: { organization },
      body: definedBody({
        name: args.name,
        type: args.type,
        comparison: args.comparison,
        target_seconds: args.target_seconds,
        period: args.period,
        member_id: args.member_id,
        timezone: args.timezone,
        week_start: args.week_start,
      }),
      confirm: args.confirm,
      summary: `Create goal ${args.name}.`,
    });
  }
  if (args.goal_id === undefined) throw new ConnectorError("input", "goal_id is required.");
  if (args.action === "get") {
    return callSolidtime(runtime, requireOp("solidtime_goals", "get"), {
      params: { organization, goal: args.goal_id },
    });
  }
  if (args.action === "update") {
    return callSolidtime(runtime, requireOp("solidtime_goals", "update"), {
      params: { organization, goal: args.goal_id },
      body: definedBody({
        name: args.name,
        comparison: args.comparison,
        target_seconds: args.target_seconds,
        period: args.period,
        timezone: args.timezone,
        week_start: args.week_start,
        is_archived: args.is_archived,
        type: args.type,
        member_id: args.member_id,
      }),
      confirm: args.confirm,
      summary: "Update a goal.",
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_goals", "delete"), {
    params: { organization, goal: args.goal_id },
    confirm: args.confirm,
    summary: "Delete a goal.",
    warnings: [DELETE_WARNING],
  });
}
