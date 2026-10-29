import { z } from "zod";
import { callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  confirmField,
  DELETE_WARNING,
  idString,
  organizationIdField,
  weekdayField,
} from "./fields.js";
import { definedBody } from "./json.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

export const meInput = z.object({});
export const membershipsInput = z.object({});

export const userUpdateInput = z.object({
  user_id: idString.describe("User UUID. Use the id from solidtime_me."),
  name: z.string().trim().min(1).max(255).optional(),
  email: z.email().max(255).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  week_start: weekdayField.optional(),
  send_time_entry_still_running_email: z.boolean().optional(),
  confirm: confirmField,
});

export const userSetOrganizationInput = z.object({
  organization_id: organizationIdField,
  confirm: confirmField,
});

export const userDeleteInput = z.object({
  user_id: idString.describe("User UUID to delete. Irreversible."),
  password: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Account password when the API requires it."),
  confirm: confirmField,
});

export const userEmailInput = z.object({
  action: z.enum(["resend_verification", "reset_pending"]),
  user_id: idString,
  confirm: confirmField,
});

export const apiTokensInput = z.object({
  action: z.enum(["list", "create", "revoke", "delete"]),
  name: z.string().trim().min(1).max(255).optional().describe("Token name. Required for create."),
  api_token_id: idString.optional().describe("Token UUID. Required for revoke and delete."),
  confirm: confirmField,
});

export async function me(runtime: Runtime): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_me", undefined));
}

export async function memberships(runtime: Runtime): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_memberships", undefined));
}

export async function userUpdate(
  runtime: Runtime,
  args: z.output<typeof userUpdateInput>,
): Promise<Record<string, unknown>> {
  const body = definedBody({
    name: args.name,
    email: args.email,
    timezone: args.timezone,
    week_start: args.week_start,
    send_time_entry_still_running_email: args.send_time_entry_still_running_email,
  });
  return callSolidtime(runtime, requireOp("solidtime_user_update", undefined), {
    params: { user: args.user_id },
    body: body ?? {},
    confirm: args.confirm,
    summary: "Update the authenticated user.",
  });
}

export async function userSetOrganization(
  runtime: Runtime,
  args: z.output<typeof userSetOrganizationInput>,
): Promise<Record<string, unknown>> {
  const organizationId = args.organization_id ?? runtime.config.organizationId;
  if (organizationId === undefined) {
    throw new ConnectorError("input", "organization_id is required.");
  }
  return callSolidtime(runtime, requireOp("solidtime_user_set_organization", undefined), {
    body: { organization_id: organizationId },
    confirm: args.confirm,
    summary: "Set the current organization.",
  });
}

export async function userDelete(
  runtime: Runtime,
  args: z.output<typeof userDeleteInput>,
): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_user_delete", undefined), {
    params: { user: args.user_id },
    body: definedBody({ password: args.password }),
    confirm: args.confirm,
    summary: "Delete the user.",
    warnings: [DELETE_WARNING],
  });
}

export async function userEmail(
  runtime: Runtime,
  args: z.output<typeof userEmailInput>,
): Promise<Record<string, unknown>> {
  return callSolidtime(runtime, requireOp("solidtime_user_email", args.action), {
    params: { user: args.user_id },
    confirm: args.confirm,
    summary:
      args.action === "resend_verification"
        ? "Resend the pending email verification."
        : "Reset the pending email.",
  });
}

export async function apiTokens(
  runtime: Runtime,
  args: z.output<typeof apiTokensInput>,
): Promise<Record<string, unknown>> {
  if (args.action === "list") {
    return callSolidtime(runtime, requireOp("solidtime_api_tokens", "list"));
  }
  if (args.action === "create") {
    if (args.name === undefined) {
      throw new ConnectorError("input", "name is required to create an API token.");
    }
    return callSolidtime(runtime, requireOp("solidtime_api_tokens", "create"), {
      body: { name: args.name },
      confirm: args.confirm,
      summary: "Create an API token. The access_token is redacted in output.",
    });
  }
  if (args.api_token_id === undefined) {
    throw new ConnectorError("input", "api_token_id is required.");
  }
  return callSolidtime(runtime, requireOp("solidtime_api_tokens", args.action), {
    params: { apiToken: args.api_token_id },
    confirm: args.confirm,
    summary: args.action === "revoke" ? "Revoke an API token." : "Delete an API token.",
    warnings: args.action === "delete" ? [DELETE_WARNING] : [],
  });
}
