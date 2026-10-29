import { callSolidtime } from "./call.js";
import { ConnectorError } from "./errors.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function membershipOrgId(row: unknown): string | undefined {
  const record = asRecord(row);
  if (record === undefined) return undefined;
  const organization = asRecord(record["organization"]);
  const nested = organization?.["id"];
  if (typeof nested === "string" && nested.length > 0) return nested;
  const direct = record["organization_id"];
  if (typeof direct === "string" && direct.length > 0) return direct;
  return undefined;
}

function membershipRows(payload: Record<string, unknown>): unknown[] {
  const data = payload["data"];
  if (Array.isArray(data)) return data;
  const items = payload["items"];
  if (Array.isArray(items)) return items;
  if (Array.isArray(payload["data"])) return payload["data"];
  return [];
}

export async function resolveOrganizationId(
  runtime: Runtime,
  organizationId: string | undefined,
): Promise<string> {
  if (organizationId !== undefined && organizationId.length > 0) return organizationId;
  if (runtime.config.organizationId !== undefined) return runtime.config.organizationId;
  const payload = await callSolidtime(runtime, requireOp("solidtime_memberships", undefined));
  const rows = membershipRows(payload);
  const ids: string[] = [];
  for (const row of rows) {
    const id = membershipOrgId(row);
    if (id !== undefined) ids.push(id);
  }
  if (ids.length === 0) {
    throw new ConnectorError(
      "input",
      "No organization memberships. Pass organization_id or set SOLIDTIME_ORGANIZATION_ID.",
    );
  }
  if (ids.length === 1) {
    const only = ids[0];
    if (only === undefined) {
      throw new ConnectorError("input", "No organization memberships.");
    }
    return only;
  }
  throw new ConnectorError(
    "input",
    "Multiple organizations. Pass organization_id or set SOLIDTIME_ORGANIZATION_ID.",
  );
}
