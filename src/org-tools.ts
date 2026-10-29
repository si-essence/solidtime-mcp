import { z } from "zod";
import { callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  centsField,
  confirmField,
  DELETE_WARNING,
  estimatedSecondsField,
  idString,
  inviteRoleField,
  INVITE_WARNING,
  nameField,
  organizationIdField,
  RATE_CHANGE_WARNING,
  roleField,
} from "./fields.js";
import { definedBody, definedQuery } from "./json.js";
import { resolveOrganizationId } from "./org.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

export const organizationGetInput = z.object({ organization_id: organizationIdField });
export const organizationCreateInput = z.object({
  name: nameField,
  confirm: confirmField,
});
export const organizationUpdateInput = z.object({
  organization_id: organizationIdField,
  name: z.string().trim().min(1).max(255).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  billable_rate: centsField.nullable().optional(),
  employees_can_see_billable_rates: z.boolean().optional(),
  employees_can_manage_tasks: z.boolean().optional(),
  prevent_overlapping_time_entries: z.boolean().optional(),
  breaks_enabled: z.boolean().optional(),
  confirm: confirmField,
});
export const organizationDeleteInput = z.object({
  organization_id: organizationIdField,
  password: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Account password. Required by Solidtime to delete an organization."),
  confirm: confirmField,
});

export const membersListInput = z.object({ organization_id: organizationIdField });
export const memberUpdateInput = z.object({
  organization_id: organizationIdField,
  member_id: idString,
  role: roleField.optional(),
  billable_rate: centsField.nullable().optional(),
  confirm: confirmField,
});
export const memberRemoveInput = z.object({
  organization_id: organizationIdField,
  member_id: idString,
  confirm: confirmField,
});
export const memberInvitePlaceholderInput = z.object({
  organization_id: organizationIdField,
  member_id: idString,
  email: z.email().max(255),
  confirm: confirmField,
});
export const memberMakePlaceholderInput = z.object({
  organization_id: organizationIdField,
  member_id: idString,
  confirm: confirmField,
});
export const memberMergeInput = z.object({
  organization_id: organizationIdField,
  member_id: idString.describe("Source member UUID that will be merged away."),
  destination_member_id: idString.describe("Destination member UUID that keeps the data."),
  confirm: confirmField,
});

export const invitationsInput = z.object({
  action: z.enum(["list", "invite", "resend", "remove"]),
  organization_id: organizationIdField,
  invitation_id: idString.optional(),
  email: z.email().max(255).optional(),
  role: inviteRoleField.optional(),
  confirm: confirmField,
});

export const projectsListInput = z.object({
  organization_id: organizationIdField,
  page: z.number().int().min(1).max(2147483647).optional(),
  archived: z.boolean().optional(),
});
export const projectGetInput = z.object({
  organization_id: organizationIdField,
  project_id: idString,
});
export const projectCreateInput = z.object({
  organization_id: organizationIdField,
  name: nameField,
  color: z.string().trim().min(1).max(255).describe("Project color, for example #0f766e."),
  is_billable: z.boolean(),
  client_id: idString.nullable(),
  billable_rate: centsField.nullable().optional(),
  estimated_time: estimatedSecondsField.nullable().optional(),
  is_public: z.boolean().optional(),
  confirm: confirmField,
});
export const projectUpdateInput = z.object({
  organization_id: organizationIdField,
  project_id: idString,
  name: nameField,
  color: z.string().trim().min(1).max(255),
  is_billable: z.boolean(),
  client_id: idString.nullable(),
  is_archived: z.boolean().optional(),
  is_public: z.boolean().optional(),
  billable_rate: centsField.nullable().optional(),
  estimated_time: estimatedSecondsField.nullable().optional(),
  confirm: confirmField,
});
export const projectDeleteInput = z.object({
  organization_id: organizationIdField,
  project_id: idString,
  confirm: confirmField,
});

export const projectMembersInput = z.object({
  action: z.enum(["list", "create", "update", "delete"]),
  organization_id: organizationIdField,
  project_id: idString.optional(),
  project_member_id: idString.optional(),
  member_id: idString.optional(),
  billable_rate: centsField.nullable().optional(),
  confirm: confirmField,
});

async function orgId(runtime: Runtime, organizationId: string | undefined): Promise<string> {
  return resolveOrganizationId(runtime, organizationId);
}

export async function organizationGet(
  runtime: Runtime,
  args: z.output<typeof organizationGetInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_organization_get", undefined), {
    params: { organization },
  });
}

export async function organizationCreate(
  runtime: Runtime,
  args: z.output<typeof organizationCreateInput>,
): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_organization_create", undefined), {
    body: { name: args.name },
    confirm: args.confirm,
    summary: `Create organization ${args.name}.`,
  });
}

export async function organizationUpdate(
  runtime: Runtime,
  args: z.output<typeof organizationUpdateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  const warnings = args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [];
  return callSolidtime(runtime, requireOp("solidtime_organization_update", undefined), {
    params: { organization },
    body: definedBody({
      name: args.name,
      currency: args.currency,
      billable_rate: args.billable_rate,
      employees_can_see_billable_rates: args.employees_can_see_billable_rates,
      employees_can_manage_tasks: args.employees_can_manage_tasks,
      prevent_overlapping_time_entries: args.prevent_overlapping_time_entries,
      breaks_enabled: args.breaks_enabled,
    }),
    confirm: args.confirm,
    summary: "Update the organization.",
    warnings,
  });
}

export async function organizationDelete(
  runtime: Runtime,
  args: z.output<typeof organizationDeleteInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_organization_delete", undefined), {
    params: { organization },
    body: definedBody({ password: args.password }),
    confirm: args.confirm,
    summary: "Delete the organization.",
    warnings: [DELETE_WARNING],
  });
}

export async function membersList(
  runtime: Runtime,
  args: z.output<typeof membersListInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_members_list", undefined), {
    params: { organization },
  });
}

export async function memberUpdate(
  runtime: Runtime,
  args: z.output<typeof memberUpdateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  const warnings = args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [];
  return callSolidtime(runtime, requireOp("solidtime_member_update", undefined), {
    params: { organization, member: args.member_id },
    body: definedBody({ role: args.role, billable_rate: args.billable_rate }),
    confirm: args.confirm,
    summary: "Update a member.",
    warnings,
  });
}

export async function memberRemove(
  runtime: Runtime,
  args: z.output<typeof memberRemoveInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_member_remove", undefined), {
    params: { organization, member: args.member_id },
    confirm: args.confirm,
    summary: "Remove a member.",
    warnings: [DELETE_WARNING],
  });
}

export async function memberInvitePlaceholder(
  runtime: Runtime,
  args: z.output<typeof memberInvitePlaceholderInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_member_invite_placeholder", undefined), {
    params: { organization, member: args.member_id },
    body: { email: args.email },
    confirm: args.confirm,
    summary: "Invite a placeholder member.",
    warnings: [INVITE_WARNING],
  });
}

export async function memberMakePlaceholder(
  runtime: Runtime,
  args: z.output<typeof memberMakePlaceholderInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_member_make_placeholder", undefined), {
    params: { organization, member: args.member_id },
    confirm: args.confirm,
    summary: "Make a member a placeholder.",
  });
}

export async function memberMerge(
  runtime: Runtime,
  args: z.output<typeof memberMergeInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_member_merge", undefined), {
    params: { organization, member: args.member_id },
    body: { member_id: args.destination_member_id },
    confirm: args.confirm,
    summary: "Merge a member into another.",
    warnings: [DELETE_WARNING],
  });
}

export async function invitations(
  runtime: Runtime,
  args: z.output<typeof invitationsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_invitations", "list"), {
      params: { organization },
    });
  }
  if (args.action === "invite") {
    if (args.email === undefined || args.role === undefined) {
      throw new ConnectorError("input", "email and role are required to invite.");
    }
    return callSolidtime(runtime, requireOp("solidtime_invitations", "invite"), {
      params: { organization },
      body: { email: args.email, role: args.role },
      confirm: args.confirm,
      summary: "Invite a user.",
      warnings: [INVITE_WARNING],
    });
  }
  if (args.invitation_id === undefined) {
    throw new ConnectorError("input", "invitation_id is required.");
  }
  return callSolidtime(runtime, requireOp("solidtime_invitations", args.action), {
    params: { organization, invitation: args.invitation_id },
    confirm: args.confirm,
    summary: args.action === "resend" ? "Resend an invitation." : "Remove an invitation.",
    warnings: args.action === "remove" ? [DELETE_WARNING] : [INVITE_WARNING],
  });
}

export async function projectsList(
  runtime: Runtime,
  args: z.output<typeof projectsListInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_projects_list", undefined), {
    params: { organization },
    query: definedQuery({
      page: args.page,
      archived: args.archived,
    }),
  });
}

export async function projectGet(
  runtime: Runtime,
  args: z.output<typeof projectGetInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_project_get", undefined), {
    params: { organization, project: args.project_id },
  });
}

export async function projectCreate(
  runtime: Runtime,
  args: z.output<typeof projectCreateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  const warnings = args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [];
  return callSolidtime(runtime, requireOp("solidtime_project_create", undefined), {
    params: { organization },
    body: definedBody({
      name: args.name,
      color: args.color,
      is_billable: args.is_billable,
      client_id: args.client_id,
      billable_rate: args.billable_rate,
      estimated_time: args.estimated_time,
      is_public: args.is_public,
    }),
    confirm: args.confirm,
    summary: `Create project ${args.name}.`,
    warnings,
  });
}

export async function projectUpdate(
  runtime: Runtime,
  args: z.output<typeof projectUpdateInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  const warnings = args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [];
  return callSolidtime(runtime, requireOp("solidtime_project_update", undefined), {
    params: { organization, project: args.project_id },
    body: definedBody({
      name: args.name,
      color: args.color,
      is_billable: args.is_billable,
      client_id: args.client_id,
      is_archived: args.is_archived,
      is_public: args.is_public,
      billable_rate: args.billable_rate,
      estimated_time: args.estimated_time,
    }),
    confirm: args.confirm,
    summary: "Update a project.",
    warnings,
  });
}

export async function projectDelete(
  runtime: Runtime,
  args: z.output<typeof projectDeleteInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  return callSolidtime(runtime, requireOp("solidtime_project_delete", undefined), {
    params: { organization, project: args.project_id },
    confirm: args.confirm,
    summary: "Delete a project.",
    warnings: [DELETE_WARNING],
  });
}

export async function projectMembers(
  runtime: Runtime,
  args: z.output<typeof projectMembersInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list" || args.action === "create") {
    if (args.project_id === undefined) {
      throw new ConnectorError("input", "project_id is required.");
    }
    if (args.action === "list") {
      return callSolidtime(runtime, requireOp("solidtime_project_members", "list"), {
        params: { organization, project: args.project_id },
      });
    }
    if (args.member_id === undefined) {
      throw new ConnectorError("input", "member_id is required.");
    }
    return callSolidtime(runtime, requireOp("solidtime_project_members", "create"), {
      params: { organization, project: args.project_id },
      body: definedBody({ member_id: args.member_id, billable_rate: args.billable_rate }),
      confirm: args.confirm,
      summary: "Add a project member.",
      warnings: args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [],
    });
  }
  if (args.project_member_id === undefined) {
    throw new ConnectorError("input", "project_member_id is required.");
  }
  if (args.action === "update") {
    return callSolidtime(runtime, requireOp("solidtime_project_members", "update"), {
      params: { organization, projectMember: args.project_member_id },
      body: definedBody({ billable_rate: args.billable_rate }),
      confirm: args.confirm,
      summary: "Update a project member.",
      warnings: args.billable_rate !== undefined ? [RATE_CHANGE_WARNING] : [],
    });
  }
  return callSolidtime(runtime, requireOp("solidtime_project_members", "delete"), {
    params: { organization, projectMember: args.project_member_id },
    confirm: args.confirm,
    summary: "Remove a project member.",
    warnings: [DELETE_WARNING],
  });
}
