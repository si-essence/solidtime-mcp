import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it } from "vitest";
import { toolIsWrite, toolNames } from "../src/operations.js";
import { BASE, ORG, TOKEN, expectAuth, jsonFetch, jsonResponse, runtimeFor } from "./harness.js";
import { connectServer } from "./mcp.js";
import { readToolText } from "./result.js";

const TOOL_NAMES = toolNames();
const WRITE_TOOLS = new Set(TOOL_NAMES.filter((name) => toolIsWrite(name)));
const ORG_PATH = `${BASE}/api/v1/organizations/${ORG}`;

const READ_ARGS: Record<string, Record<string, unknown>> = {
  solidtime_me: {},
  solidtime_memberships: {},
  solidtime_countries: {},
  solidtime_currencies: {},
  solidtime_time_zones: {},
  solidtime_organization_get: {},
  solidtime_members_list: {},
  solidtime_projects_list: {},
  solidtime_project_get: { project_id: "project-1" },
  solidtime_time_entries_list: {},
  solidtime_time_entries_export: {
    format: "csv",
    start: "2026-01-01T00:00:00Z",
    end: "2026-01-31T00:00:00Z",
  },
  solidtime_time_entries_aggregate: { group: "project" },
  solidtime_time_entries_aggregate_export: {
    format: "csv",
    group: "project",
    sub_group: "task",
    history_group: "week",
    start: "2026-01-01T00:00:00Z",
    end: "2026-01-31T00:00:00Z",
  },
  solidtime_timer_active: {},
  solidtime_public_report: { share: "share-secret" },
  solidtime_charts: { action: "daily_tracked_hours" },
  solidtime_importers: {},
};

const WRITE_ARGS: Record<string, Record<string, unknown>> = {
  solidtime_user_update: { user_id: "user-1", name: "MCP User" },
  solidtime_user_set_organization: { organization_id: ORG },
  solidtime_user_delete: { user_id: "user-1" },
  solidtime_user_email: { action: "resend_verification", user_id: "user-1" },
  solidtime_api_tokens: { action: "create", name: "mcp-token" },
  solidtime_organization_create: { name: "MCP Org" },
  solidtime_organization_update: { name: "MCP Org", billable_rate: 8000 },
  solidtime_organization_delete: {},
  solidtime_member_update: { member_id: "member-1", billable_rate: 9000 },
  solidtime_member_remove: { member_id: "member-1" },
  solidtime_member_invite_placeholder: { member_id: "member-1", email: "new@example.com" },
  solidtime_member_make_placeholder: { member_id: "member-1" },
  solidtime_member_merge: { member_id: "member-1", destination_member_id: "member-2" },
  solidtime_invitations: { action: "invite", email: "invite@example.com", role: "employee" },
  solidtime_project_create: {
    name: "MCP Project",
    color: "#0f766e",
    is_billable: true,
    client_id: null,
    billable_rate: 5000,
  },
  solidtime_project_update: {
    project_id: "project-1",
    name: "MCP Project",
    color: "#0f766e",
    is_billable: true,
    client_id: null,
    billable_rate: 5000,
  },
  solidtime_project_delete: { project_id: "project-1" },
  solidtime_project_members: { action: "create", project_id: "project-1", member_id: "member-1" },
  solidtime_clients: { action: "create", name: "MCP Client" },
  solidtime_tags: { action: "create", name: "mcp" },
  solidtime_tasks: { action: "create", name: "MCP Task", project_id: "project-1" },
  solidtime_goals: {
    action: "create",
    name: "MCP Goal",
    type: "personal",
    comparison: "at_least",
    target_seconds: 3600,
    period: "week",
  },
  solidtime_time_entry_create: {
    member_id: "member-1",
    start: "2026-01-02T10:00:00Z",
    billable: true,
  },
  solidtime_time_entry_update: {
    time_entry_id: "entry-1",
    end: "2026-01-02T11:00:00Z",
  },
  solidtime_time_entry_delete: { time_entry_id: "entry-1" },
  solidtime_time_entries_bulk_update: { ids: ["entry-1", "entry-2"], billable: false },
  solidtime_time_entries_bulk_delete: { ids: ["entry-1", "entry-2"] },
  solidtime_timer_start: { member_id: "member-1", billable: true },
  solidtime_timer_stop: { time_entry_id: "entry-1", end: "2026-01-02T12:00:00Z" },
  solidtime_reports: {
    action: "create",
    name: "MCP Report",
    is_public: false,
    properties_start: "2026-01-01T00:00:00Z",
    properties_end: "2026-01-31T00:00:00Z",
    properties_group: "project",
    properties_sub_group: "task",
    properties_history_group: "week",
  },
  solidtime_import: { type: "toggl", data: "csv-bytes" },
  solidtime_export_organization: {},
  solidtime_invoice_settings: { action: "update", seller_name: "MCP Seller" },
  solidtime_invoice_recipients: { action: "create", name: "Acme" },
  solidtime_invoices: {
    action: "create",
    seller_name: "MCP Seller",
    invoice_recipient_id: "recipient-1",
    date: "2026-01-02T00:00:00Z",
    reference: "INV-1",
    currency: "EUR",
  },
  solidtime_cancel_trial: {},
};

const EXPECTED_WRITE_METHOD: Record<string, string> = {
  solidtime_user_update: "PUT",
  solidtime_user_set_organization: "PUT",
  solidtime_user_delete: "DELETE",
  solidtime_user_email: "POST",
  solidtime_api_tokens: "POST",
  solidtime_organization_create: "POST",
  solidtime_organization_update: "PUT",
  solidtime_organization_delete: "DELETE",
  solidtime_member_update: "PUT",
  solidtime_member_remove: "DELETE",
  solidtime_member_invite_placeholder: "POST",
  solidtime_member_make_placeholder: "POST",
  solidtime_member_merge: "POST",
  solidtime_invitations: "POST",
  solidtime_project_create: "POST",
  solidtime_project_update: "PUT",
  solidtime_project_delete: "DELETE",
  solidtime_project_members: "POST",
  solidtime_clients: "POST",
  solidtime_tags: "POST",
  solidtime_tasks: "POST",
  solidtime_goals: "POST",
  solidtime_time_entry_create: "POST",
  solidtime_time_entry_update: "PUT",
  solidtime_time_entry_delete: "DELETE",
  solidtime_time_entries_bulk_update: "PATCH",
  solidtime_time_entries_bulk_delete: "DELETE",
  solidtime_timer_start: "POST",
  solidtime_timer_stop: "PUT",
  solidtime_reports: "POST",
  solidtime_import: "POST",
  solidtime_export_organization: "POST",
  solidtime_invoice_settings: "PUT",
  solidtime_invoice_recipients: "POST",
  solidtime_invoices: "POST",
  solidtime_cancel_trial: "POST",
};

async function withClient(
  fetchImpl: typeof fetch,
  extra: NodeJS.ProcessEnv,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const runtime = runtimeFor(fetchImpl, extra);
  const connected = await connectServer(runtime);
  try {
    await run(connected.client);
  } finally {
    await connected.close();
  }
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean; json: Record<string, unknown> | null }> {
  const result = readToolText(await client.callTool({ name, arguments: args }));
  expect(result.text).not.toContain(TOKEN);
  if (result.isError) return { ...result, json: null };
  return { ...result, json: JSON.parse(result.text) as Record<string, unknown> };
}

function leakyResponse(): Response {
  return jsonResponse({
    data: {
      id: "rec-1",
      name: `hello ${TOKEN}`,
      access_token: TOKEN,
      token: TOKEN,
      leak: "/tmp/solidtime/secret.db",
    },
  });
}

describe("solidtime tools", () => {
  it("publishes every tool with a description and confirm on writes", async () => {
    const { fetchImpl } = jsonFetch(() => jsonResponse({}));
    await withClient(fetchImpl, {}, async (client) => {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(TOOL_NAMES);
      for (const tool of listed.tools) {
        expect((tool.description ?? "").trim().length).toBeGreaterThan(20);
        const schema = JSON.stringify(tool.inputSchema);
        if (WRITE_TOOLS.has(tool.name)) expect(schema).toContain("confirm");
        else expect(schema).not.toContain("confirm");
      }
    });
  });

  it("lists memberships and redacts secrets and filesystem paths", async () => {
    const { fetchImpl, calls } = jsonFetch((captured) => {
      expectAuth(captured);
      return leakyResponse();
    });
    await withClient(fetchImpl, {}, async (client) => {
      const listed = await call(client, "solidtime_memberships", {});
      expect(listed.isError).toBe(false);
      expect(JSON.stringify(listed.json)).toContain("[redacted]");
      expect(JSON.stringify(listed.json)).not.toContain("/tmp");
      expect(JSON.stringify(listed.json)).not.toContain(TOKEN);
      expect(calls[0]?.url).toBe(`${BASE}/api/v1/users/me/memberships`);
      expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    });
  });

  it("previews create without calling upstream, then executes with confirm", async () => {
    const { fetchImpl, calls } = jsonFetch(() => jsonResponse({ data: { id: "client-1" } }));
    await withClient(fetchImpl, {}, async (client) => {
      const preview = await call(client, "solidtime_clients", {
        action: "create",
        name: "MCP Client",
      });
      expect(preview.json).toMatchObject({
        executed: false,
        dry_run: true,
        blocked: false,
        method: "POST",
        path: `api/v1/organizations/${ORG}/clients`,
      });
      expect(calls).toHaveLength(0);
      const created = await call(client, "solidtime_clients", {
        action: "create",
        name: "MCP Client",
        confirm: true,
      });
      expect(created.json).toMatchObject({ executed: true, dry_run: false });
      expect(calls[0]?.method).toBe("POST");
    });
  });

  it("blocks writes when SOLIDTIME_ALLOW_WRITES is not true", async () => {
    const { fetchImpl, calls } = jsonFetch(() => jsonResponse({}));
    await withClient(fetchImpl, { SOLIDTIME_ALLOW_WRITES: "false" }, async (client) => {
      const result = await call(client, "solidtime_project_delete", {
        project_id: "project-1",
        confirm: true,
      });
      expect(result.json).toMatchObject({ executed: false, blocked: true, method: "DELETE" });
      expect(calls).toHaveLength(0);
    });
  });

  it("warns about billable rate changes in the preview", async () => {
    const { fetchImpl, calls } = jsonFetch(() => jsonResponse({}));
    await withClient(fetchImpl, {}, async (client) => {
      const preview = await call(client, "solidtime_member_update", {
        member_id: "member-1",
        billable_rate: 9000,
      });
      expect(JSON.stringify(preview.json)).toContain("reprice");
      expect(calls).toHaveLength(0);
    });
  });
});

describe("every registered tool", () => {
  it("has a coverage case for each published name", async () => {
    const { fetchImpl } = jsonFetch(() => jsonResponse({}));
    await withClient(fetchImpl, {}, async (client) => {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(TOOL_NAMES);
    });
    const covered = [...Object.keys(READ_ARGS), ...Object.keys(WRITE_ARGS)].sort();
    expect(covered).toEqual(TOOL_NAMES);
    expect(Object.keys(WRITE_ARGS).sort()).toEqual([...WRITE_TOOLS].sort());
  });

  it("sends method, URL, and Bearer token on the happy path and never echoes the token", async () => {
    const invoked = new Set<string>();
    for (const name of TOOL_NAMES) {
      const { fetchImpl, calls } = jsonFetch((captured) => {
        if (!captured.url.includes("/public/reports")) expectAuth(captured);
        return leakyResponse();
      });
      await withClient(fetchImpl, {}, async (client) => {
        const args = WRITE_TOOLS.has(name)
          ? { ...WRITE_ARGS[name], confirm: true }
          : (READ_ARGS[name] ?? {});
        const result = await call(client, name, args);
        expect(result.isError).toBe(false);
        expect(result.text).not.toContain(TOKEN);
        expect(JSON.stringify(result.json)).not.toContain("/tmp");
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0]?.url.startsWith(`${BASE}/api/`)).toBe(true);
        invoked.add(name);
      });
    }
    expect([...invoked].sort()).toEqual(TOOL_NAMES);
  });

  it("previews every write without calling upstream, then executes with confirm true", async () => {
    for (const name of WRITE_TOOLS) {
      const { fetchImpl, calls } = jsonFetch(() => leakyResponse());
      await withClient(fetchImpl, {}, async (client) => {
        const preview = await call(client, name, WRITE_ARGS[name] ?? {});
        expect(preview.isError).toBe(false);
        expect(preview.json).toMatchObject({
          executed: false,
          dry_run: true,
          blocked: false,
          method: EXPECTED_WRITE_METHOD[name],
        });
        expect(typeof preview.json?.["path"]).toBe("string");
        expect(String(preview.json?.["path"]).startsWith("api/")).toBe(true);
        expect(calls).toHaveLength(0);

        const executed = await call(client, name, { ...WRITE_ARGS[name], confirm: true });
        expect(executed.isError).toBe(false);
        expect(executed.json).toMatchObject({ executed: true, dry_run: false });
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0]?.method).toBe(EXPECTED_WRITE_METHOD[name]);
        expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
      });
    }
  });

  it("rejects confirm false and the string true, and surfaces 401 404 422 429 safely", async () => {
    const { fetchImpl: falseFetch } = jsonFetch(() => jsonResponse({}));
    await withClient(falseFetch, {}, async (client) => {
      const asFalse = await call(client, "solidtime_time_entry_delete", {
        time_entry_id: "entry-1",
        confirm: false,
      });
      expect(asFalse.isError).toBe(true);
      const asString = await call(client, "solidtime_time_entry_delete", {
        time_entry_id: "entry-1",
        confirm: "true",
      });
      expect(asString.isError).toBe(true);
    });

    const cases: {
      status: number;
      body: string;
      retryAfter?: string;
      expectText: string;
    }[] = [
      { status: 401, body: `unauthenticated ${TOKEN}`, expectText: "401" },
      { status: 404, body: `missing ${TOKEN}`, expectText: "404" },
      {
        status: 422,
        body: JSON.stringify({
          message: "The given data was invalid.",
          errors: { name: ["The name field is required."] },
        }),
        expectText: "422",
      },
      {
        status: 429,
        body: `slow down ${TOKEN}`,
        retryAfter: "12",
        expectText: "429",
      },
    ];
    for (const item of cases) {
      const headers = new Headers({ "content-type": "application/json" });
      if (item.retryAfter !== undefined) headers.set("retry-after", item.retryAfter);
      const { fetchImpl } = jsonFetch(
        () => new Response(item.body, { status: item.status, headers }),
      );
      await withClient(fetchImpl, {}, async (client) => {
        const result = await call(client, "solidtime_me", {});
        expect(result.isError).toBe(true);
        expect(result.text).toContain(item.expectText);
        expect(result.text).not.toContain(TOKEN);
        if (item.status === 422) expect(result.text).toContain("name");
        if (item.status === 429) expect(result.text).toContain("Retry-After");
      });
    }
  });

  it("maps professional-plan 403 to a clean not-available error", async () => {
    const { fetchImpl } = jsonFetch(
      () =>
        new Response(JSON.stringify({ message: "This professional feature is not enabled." }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    );
    await withClient(fetchImpl, {}, async (client) => {
      const result = await call(client, "solidtime_invoice_settings", { action: "get" });
      expect(result.isError).toBe(true);
      expect(result.text).toContain("not available on this plan");
    });
  });

  it("maps a missing invoice route 404 to not available on this plan or instance", async () => {
    const { fetchImpl } = jsonFetch(
      () =>
        new Response(JSON.stringify({ message: "API resource not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    await withClient(fetchImpl, {}, async (client) => {
      const result = await call(client, "solidtime_invoices", { action: "list" });
      expect(result.isError).toBe(true);
      expect(result.text).toContain("not available on this plan or instance");
    });
  });

  it("sends the public report share secret as X-Api-Key", async () => {
    const { fetchImpl, calls } = jsonFetch(() => jsonResponse({ data: {} }));
    await withClient(fetchImpl, {}, async (client) => {
      const result = await call(client, "solidtime_public_report", { share: "share-secret" });
      expect(result.isError).toBe(false);
      expect(calls[0]?.url).toBe(`${BASE}/api/v1/public/reports`);
      expect(calls[0]?.xApiKey).toBe("share-secret");
    });
  });

  it("returns an empty timer when Solidtime has no active time entry", async () => {
    const { fetchImpl } = jsonFetch(
      () =>
        new Response(JSON.stringify({ message: "No active time entry" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    await withClient(fetchImpl, {}, async (client) => {
      const result = await call(client, "solidtime_timer_active", {});
      expect(result.isError).toBe(false);
      expect(result.json).toMatchObject({ data: null, active: false });
    });
  });

  it("hits the org-scoped path for a list tool", async () => {
    const { fetchImpl, calls } = jsonFetch(() => leakyResponse());
    await withClient(fetchImpl, {}, async (client) => {
      await call(client, "solidtime_projects_list", {});
      expect(calls[0]?.url).toBe(`${ORG_PATH}/projects`);
    });
  });
});
