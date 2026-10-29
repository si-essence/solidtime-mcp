import { z } from "zod";
import { confirmField } from "./confirm.js";
import { fixedError } from "./zod-messages.js";

export { confirmField };

const invalidId = fixedError("id must be a non-empty string");
const invalidName = fixedError("name must be 1-255 characters");

export const idString = z.string({ error: invalidId }).trim().min(1, { error: invalidId }).max(128);

export const organizationIdField = idString
  .optional()
  .describe(
    "Organization UUID. Falls back to SOLIDTIME_ORGANIZATION_ID, then a single membership from GET /v1/users/me/memberships.",
  );

export const nameField = z
  .string({ error: invalidName })
  .trim()
  .min(1, { error: invalidName })
  .max(255);

export const isoUtc = z
  .string()
  .trim()
  .min(10)
  .max(40)
  .describe('UTC timestamp like "2000-02-22T14:58:59Z".');

export const roleField = z.enum(["owner", "admin", "manager", "employee", "placeholder"]);
export const inviteRoleField = z.enum(["admin", "manager", "employee"]);
export const timeEntryTypeField = z.enum(["work", "break"]);
export const exportFormatField = z.enum(["csv", "pdf", "xlsx", "ods"]);
export const weekdayField = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
export const tagMatchTypeField = z.enum(["contains", "not_contains"]);
export const roundingTypeField = z.enum(["up", "down", "nearest"]);
export const aggregationTypeField = z.enum([
  "day",
  "week",
  "month",
  "year",
  "user",
  "project",
  "task",
  "client",
  "billable",
  "description",
  "tag",
  "type",
]);
export const aggregationIntervalField = z.enum(["day", "week", "month", "year"]);
export const invoiceStatusField = z.enum(["draft", "sent", "paid", "cancelled"]);
export const discountTypeField = z.enum(["percentage", "fixed"]);
export const goalTypeField = z.enum(["personal", "organization"]);
export const goalComparisonField = z.enum(["at_least", "less_than"]);
export const goalPeriodField = z.enum(["day", "week", "month"]);

export const centsField = z
  .number()
  .int()
  .min(0)
  .max(2147483647)
  .describe("Amount in cents per hour. 8000 means 80.00 in the organization currency.");

export const estimatedSecondsField = z
  .number()
  .int()
  .min(0)
  .max(2147483647)
  .describe("Estimated time in seconds.");

export const idList = z.array(idString).min(1).max(500);

export const RATE_CHANGE_WARNING = "Changing a billable rate can reprice existing time entries.";
export const DELETE_WARNING = "This delete is irreversible.";
export const BULK_WARNING = "Bulk update or delete is irreversible for the listed entries.";
export const INVITE_WARNING = "This sends an invitation email.";
