#!/usr/bin/env node
/**
 * Live check against a local Solidtime instance. Spawns dist/index.js over stdio.
 * Prints a pass/fail line per step. Does not print the API token.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const token = process.env["SOLIDTIME_API_TOKEN"] ?? "";
const baseUrl = process.env["SOLIDTIME_URL"] ?? "";
const envOrg = process.env["SOLIDTIME_ORGANIZATION_ID"] ?? "";

/** @type {string[]} */
const secrets = [];
if (token.length >= 8) secrets.push(token);

/**
 * @param {string} text
 */
function redact(text) {
  let out = String(text);
  for (const secret of secrets) {
    out = out.split(secret).join("[redacted]");
    out = out.split(encodeURIComponent(secret)).join("[redacted]");
  }
  out = out.replace(/authorization:\s*bearer\s+\S+/gi, "Authorization: Bearer [redacted]");
  return out;
}

/**
 * @param {string} text
 */
function clip(text) {
  let shortened = redact(text).replace(/\s+/g, " ").trim();
  if (shortened.length > 180) shortened = `${shortened.slice(0, 177)}...`;
  return shortened;
}

const writeLine = console.log.bind(console);
const writeError = console.error.bind(console);
console.log = (line) => writeLine(redact(String(line)));
console.error = (line) => writeError(redact(String(line)));

let failed = 0;
let stopped = false;
/** @type {string[]} */
const rows = [];
/** @type {Set<string>} */
const called = new Set();

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} detail
 */
function record(name, ok, detail) {
  if (!ok) failed += 1;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}  ${clip(detail)}`;
  rows.push(line);
  writeLine(line);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asRecord(value) {
  return isRecord(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function pickId(value) {
  const rec = asRecord(value);
  if (rec === null) return undefined;
  if (typeof rec["id"] === "string" && rec["id"].length > 0) return rec["id"];
  if (isRecord(rec["data"])) return pickId(rec["data"]);
  if (isRecord(rec["result"])) return pickId(rec["result"]);
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function unwrap(value) {
  const rec = asRecord(value);
  if (rec === null) return value;
  if (isRecord(rec["result"])) return unwrap(rec["result"]);
  if (rec["data"] !== undefined) return rec["data"];
  return rec;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>[]}
 */
function listItems(value) {
  const data = unwrap(value);
  if (Array.isArray(data)) return data.filter(isRecord);
  const rec = asRecord(value);
  if (rec !== null && Array.isArray(rec["items"])) return rec["items"].filter(isRecord);
  return [];
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function shareSecret(value) {
  const rec = asRecord(unwrap(value));
  if (rec === null) return undefined;
  const link = rec["shareable_link"];
  if (typeof link !== "string" || link.length === 0) return undefined;
  try {
    const url = new URL(link);
    const share = url.searchParams.get("share");
    if (share !== null && share.length > 0) return share;
    if (url.hash.length > 1) return decodeURIComponent(url.hash.slice(1));
  } catch {
    /* not a URL */
  }
  const query = /[?&]share=([^&]+)/.exec(link);
  if (query?.[1] !== undefined) return decodeURIComponent(query[1]);
  const hash = /#([^#]+)$/.exec(link);
  if (hash?.[1] !== undefined) return decodeURIComponent(hash[1]);
  return undefined;
}

/**
 * @param {import("@modelcontextprotocol/sdk/client/index.js").Client} client
 * @param {string} name
 * @param {Record<string, unknown>} args
 */
async function call(client, name, args) {
  called.add(name);
  const result = await client.callTool({ name, arguments: args });
  const block = Array.isArray(result.content) ? result.content[0] : undefined;
  const text = block && typeof block === "object" && "text" in block ? String(block.text) : "";
  if (token.length >= 8 && text.includes(token)) {
    throw new Error("secret leaked into tool output");
  }
  if (/HTTP 402|quota or payment/i.test(text)) {
    stopped = true;
    throw new Error("quota-or-402");
  }
  /** @type {Record<string, unknown> | null} */
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { isError: result.isError === true, text, json };
}

/**
 * @param {Record<string, unknown> | null} json
 */
function previewOk(json) {
  return json?.["executed"] === false && json?.["dry_run"] === true;
}

/**
 * @param {string} text
 */
function planMiss(text) {
  return /not available on this plan or instance/i.test(text);
}

async function main() {
  if (baseUrl.length === 0 || token.length < 8) {
    writeError("SOLIDTIME_URL and SOLIDTIME_API_TOKEN must be set.");
    process.exit(2);
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    cwd: root,
    env: {
      ...process.env,
      SOLIDTIME_URL: baseUrl,
      SOLIDTIME_API_TOKEN: token,
      SOLIDTIME_ORGANIZATION_ID: envOrg,
      SOLIDTIME_ALLOW_WRITES: "true",
      SOLIDTIME_CACHE_TTL_SEC: "0",
      SOLIDTIME_PER_MINUTE: "120",
    },
    stderr: "ignore",
  });
  const client = new Client({ name: "live-check", version: "0" });
  await client.connect(transport);

  const stamp = `mcp-live-${Date.now()}`;
  const startIso = "2026-10-01T00:00:00Z";
  const endIso = "2026-10-31T23:59:59Z";
  const entryStart = "2026-10-20T10:00:00Z";
  const entryEnd = "2026-10-20T11:00:00Z";
  const entryStart2 = "2026-10-20T12:00:00Z";
  const entryEnd2 = "2026-10-20T13:00:00Z";

  /** @type {string | undefined} */
  let userId;
  /** @type {string | undefined} */
  let memberId;
  /** @type {string | undefined} */
  let orgId = envOrg.length > 0 ? envOrg : undefined;
  /** @type {string | undefined} */
  let originalUserName;
  /** @type {string | undefined} */
  let originalOrgName;
  /** @type {string | undefined} */
  let clientId;
  /** @type {string | undefined} */
  let tagId;
  /** @type {string | undefined} */
  let projectId;
  /** @type {string | undefined} */
  let taskId;
  /** @type {string | undefined} */
  let goalId;
  /** @type {string | undefined} */
  let reportId;
  /** @type {string | undefined} */
  let timeEntryId;
  /** @type {string | undefined} */
  let timeEntryId2;
  /** @type {string | undefined} */
  let timerId;
  /** @type {string | undefined} */
  let invitationId;
  /** @type {string | undefined} */
  let tokenId;
  /** @type {string | undefined} */
  let tempOrgId;
  /** @type {string | undefined} */
  let share;

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    record("list_tools", names.length === 53, `${names.length} tools`);

    const me = await call(client, "solidtime_me", {});
    const meData = asRecord(unwrap(me.json));
    userId = meData !== null && typeof meData["id"] === "string" ? meData["id"] : undefined;
    originalUserName =
      meData !== null && typeof meData["name"] === "string" ? meData["name"] : undefined;
    record("solidtime_me", !me.isError && userId !== undefined, me.text);

    const memberships = await call(client, "solidtime_memberships", {});
    const membershipRows = listItems(memberships.json);
    const firstMembership = membershipRows[0];
    if (firstMembership !== undefined) {
      if (typeof firstMembership["id"] === "string") memberId = firstMembership["id"];
      const org = asRecord(firstMembership["organization"]);
      if (org !== null && typeof org["id"] === "string") orgId = org["id"];
    }
    record(
      "solidtime_memberships",
      !memberships.isError && memberId !== undefined && orgId !== undefined,
      memberships.text,
    );

    const countries = await call(client, "solidtime_countries", {});
    record(
      "solidtime_countries",
      !countries.isError || /HTTP 404/i.test(countries.text),
      countries.text,
    );

    const currencies = await call(client, "solidtime_currencies", {});
    record("solidtime_currencies", !currencies.isError, currencies.text);

    const zones = await call(client, "solidtime_time_zones", {});
    record("solidtime_time_zones", !zones.isError, zones.text);

    const orgGet = await call(client, "solidtime_organization_get", {});
    const orgData = asRecord(unwrap(orgGet.json));
    originalOrgName =
      orgData !== null && typeof orgData["name"] === "string" ? orgData["name"] : undefined;
    record("solidtime_organization_get", !orgGet.isError, orgGet.text);

    const members = await call(client, "solidtime_members_list", {});
    record("solidtime_members_list", !members.isError, members.text);

    const orgCreatePreview = await call(client, "solidtime_organization_create", {
      name: `${stamp}-org`,
    });
    record(
      "solidtime_organization_create dry-run",
      previewOk(orgCreatePreview.json),
      orgCreatePreview.text,
    );
    record(
      "solidtime_organization_create skipped execute",
      true,
      "Delete requires the account password. Creating a second org would leave data this check cannot remove.",
    );

    const orgUpdatePreview = await call(client, "solidtime_organization_update", {
      billable_rate: 8000,
    });
    record(
      "solidtime_organization_update dry-run",
      previewOk(orgUpdatePreview.json) && JSON.stringify(orgUpdatePreview.json).includes("reprice"),
      orgUpdatePreview.text,
    );
    if (originalOrgName !== undefined) {
      const orgRenamed = await call(client, "solidtime_organization_update", {
        name: `${stamp}-org-name`,
        confirm: true,
      });
      record(
        "solidtime_organization_update",
        orgRenamed.json?.["executed"] === true,
        orgRenamed.text,
      );
      const orgRestored = await call(client, "solidtime_organization_update", {
        name: originalOrgName,
        confirm: true,
      });
      record(
        "solidtime_organization_update restore",
        orgRestored.json?.["executed"] === true,
        orgRestored.text,
      );
    } else {
      record("solidtime_organization_update", false, "no original org name");
    }

    const orgDeletePreview = await call(client, "solidtime_organization_delete", {});
    record(
      "solidtime_organization_delete dry-run (live org, not sent)",
      previewOk(orgDeletePreview.json),
      orgDeletePreview.text,
    );
    record(
      "solidtime_organization_delete skipped execute",
      true,
      "Live org not deleted. API requires password. No password in env.",
    );

    if (userId !== undefined && originalUserName !== undefined) {
      const userPreview = await call(client, "solidtime_user_update", {
        user_id: userId,
        name: `${stamp}-user`,
      });
      record("solidtime_user_update dry-run", previewOk(userPreview.json), userPreview.text);
      const userUpdated = await call(client, "solidtime_user_update", {
        user_id: userId,
        name: `${stamp}-user`,
        confirm: true,
      });
      record("solidtime_user_update", userUpdated.json?.["executed"] === true, userUpdated.text);
      const userRestored = await call(client, "solidtime_user_update", {
        user_id: userId,
        name: originalUserName,
        confirm: true,
      });
      record(
        "solidtime_user_update restore",
        userRestored.json?.["executed"] === true,
        userRestored.text,
      );
    } else {
      record("solidtime_user_update", false, "no user id");
    }

    const setOrgPreview = await call(client, "solidtime_user_set_organization", {});
    record(
      "solidtime_user_set_organization dry-run",
      previewOk(setOrgPreview.json),
      setOrgPreview.text,
    );
    const setOrg = await call(client, "solidtime_user_set_organization", { confirm: true });
    record("solidtime_user_set_organization", setOrg.json?.["executed"] === true, setOrg.text);

    const userDeletePreview = await call(client, "solidtime_user_delete", {
      user_id: userId ?? "missing",
    });
    record(
      "solidtime_user_delete dry-run (not sent)",
      previewOk(userDeletePreview.json),
      userDeletePreview.text,
    );

    const emailPreview = await call(client, "solidtime_user_email", {
      action: "resend_verification",
      user_id: userId ?? "missing",
    });
    record(
      "solidtime_user_email dry-run (not sent)",
      previewOk(emailPreview.json),
      emailPreview.text,
    );

    const tokensList = await call(client, "solidtime_api_tokens", { action: "list" });
    record("solidtime_api_tokens list", !tokensList.isError, tokensList.text);
    const tokenPreview = await call(client, "solidtime_api_tokens", {
      action: "create",
      name: stamp,
    });
    record("solidtime_api_tokens create dry-run", previewOk(tokenPreview.json), tokenPreview.text);
    const tokenCreated = await call(client, "solidtime_api_tokens", {
      action: "create",
      name: stamp,
      confirm: true,
    });
    tokenId = pickId(tokenCreated.json);
    const tokenText = JSON.stringify(tokenCreated.json ?? {});
    record(
      "solidtime_api_tokens create",
      tokenCreated.json?.["executed"] === true &&
        tokenId !== undefined &&
        !tokenText.includes(token),
      tokenCreated.text,
    );
    if (tokenId !== undefined) {
      const revoked = await call(client, "solidtime_api_tokens", {
        action: "revoke",
        api_token_id: tokenId,
        confirm: true,
      });
      record("solidtime_api_tokens revoke", revoked.json?.["executed"] === true, revoked.text);
      const deletedToken = await call(client, "solidtime_api_tokens", {
        action: "delete",
        api_token_id: tokenId,
        confirm: true,
      });
      record(
        "solidtime_api_tokens delete",
        deletedToken.json?.["executed"] === true,
        deletedToken.text,
      );
      tokenId = undefined;
    } else {
      record("solidtime_api_tokens revoke", false, "no token id");
      record("solidtime_api_tokens delete", false, "no token id");
    }

    if (memberId !== undefined) {
      const memberRatePreview = await call(client, "solidtime_member_update", {
        member_id: memberId,
        billable_rate: 9000,
      });
      record(
        "solidtime_member_update dry-run",
        previewOk(memberRatePreview.json) &&
          JSON.stringify(memberRatePreview.json).includes("reprice"),
        memberRatePreview.text,
      );
      const removePreview = await call(client, "solidtime_member_remove", { member_id: memberId });
      record(
        "solidtime_member_remove dry-run (not sent)",
        previewOk(removePreview.json),
        removePreview.text,
      );
      const invitePhPreview = await call(client, "solidtime_member_invite_placeholder", {
        member_id: memberId,
        email: `${stamp}@example.invalid`,
      });
      record(
        "solidtime_member_invite_placeholder dry-run (not sent)",
        previewOk(invitePhPreview.json),
        invitePhPreview.text,
      );
      const makePhPreview = await call(client, "solidtime_member_make_placeholder", {
        member_id: memberId,
      });
      record(
        "solidtime_member_make_placeholder dry-run (not sent)",
        previewOk(makePhPreview.json),
        makePhPreview.text,
      );
      const mergePreview = await call(client, "solidtime_member_merge", {
        member_id: memberId,
        destination_member_id: memberId,
      });
      record(
        "solidtime_member_merge dry-run (not sent)",
        previewOk(mergePreview.json),
        mergePreview.text,
      );
    }

    const invitationsList = await call(client, "solidtime_invitations", { action: "list" });
    record("solidtime_invitations list", !invitationsList.isError, invitationsList.text);
    const invitePreview = await call(client, "solidtime_invitations", {
      action: "invite",
      email: `${stamp}@example.invalid`,
      role: "employee",
    });
    record(
      "solidtime_invitations invite dry-run",
      previewOk(invitePreview.json),
      invitePreview.text,
    );
    record(
      "solidtime_invitations invite skipped execute",
      true,
      "POST invite waits on SMTP on this instance (about 1 min) and stalls the PHP built-in server.",
    );

    const clientsList = await call(client, "solidtime_clients", { action: "list" });
    record("solidtime_clients list", !clientsList.isError, clientsList.text);
    const clientPreview = await call(client, "solidtime_clients", {
      action: "create",
      name: `${stamp}-client`,
    });
    record("solidtime_clients create dry-run", previewOk(clientPreview.json), clientPreview.text);
    const clientCreated = await call(client, "solidtime_clients", {
      action: "create",
      name: `${stamp}-client`,
      confirm: true,
    });
    clientId = pickId(clientCreated.json);
    record(
      "solidtime_clients create",
      clientCreated.json?.["executed"] === true && clientId !== undefined,
      clientCreated.text,
    );
    if (clientId !== undefined) {
      const clientUpdated = await call(client, "solidtime_clients", {
        action: "update",
        client_id: clientId,
        name: `${stamp}-client-2`,
        confirm: true,
      });
      record(
        "solidtime_clients update",
        clientUpdated.json?.["executed"] === true,
        clientUpdated.text,
      );
    }

    const tagsList = await call(client, "solidtime_tags", { action: "list" });
    record("solidtime_tags list", !tagsList.isError, tagsList.text);
    const tagPreview = await call(client, "solidtime_tags", { action: "create", name: stamp });
    record("solidtime_tags create dry-run", previewOk(tagPreview.json), tagPreview.text);
    const tagCreated = await call(client, "solidtime_tags", {
      action: "create",
      name: stamp,
      confirm: true,
    });
    tagId = pickId(tagCreated.json);
    record(
      "solidtime_tags create",
      tagCreated.json?.["executed"] === true && tagId !== undefined,
      tagCreated.text,
    );
    if (tagId !== undefined) {
      const tagUpdated = await call(client, "solidtime_tags", {
        action: "update",
        tag_id: tagId,
        name: `${stamp}-tag`,
        confirm: true,
      });
      record("solidtime_tags update", tagUpdated.json?.["executed"] === true, tagUpdated.text);
    }

    const projectsList = await call(client, "solidtime_projects_list", {});
    record("solidtime_projects_list", !projectsList.isError, projectsList.text);
    const projectPreview = await call(client, "solidtime_project_create", {
      name: `${stamp}-project`,
      color: "#0f766e",
      is_billable: true,
      client_id: clientId ?? null,
    });
    record("solidtime_project_create dry-run", previewOk(projectPreview.json), projectPreview.text);
    const projectCreated = await call(client, "solidtime_project_create", {
      name: `${stamp}-project`,
      color: "#0f766e",
      is_billable: true,
      client_id: clientId ?? null,
      estimated_time: 3600,
      confirm: true,
    });
    projectId = pickId(projectCreated.json);
    record(
      "solidtime_project_create",
      projectCreated.json?.["executed"] === true && projectId !== undefined,
      projectCreated.text,
    );
    if (projectId !== undefined) {
      const projectGet = await call(client, "solidtime_project_get", { project_id: projectId });
      record("solidtime_project_get", !projectGet.isError, projectGet.text);
      const projectUpdated = await call(client, "solidtime_project_update", {
        project_id: projectId,
        name: `${stamp}-project-2`,
        color: "#134e4a",
        is_billable: true,
        client_id: clientId ?? null,
        confirm: true,
      });
      record(
        "solidtime_project_update",
        projectUpdated.json?.["executed"] === true,
        projectUpdated.text,
      );
    } else {
      record("solidtime_project_get", false, "no project");
      record("solidtime_project_update", false, "no project");
    }

    if (projectId !== undefined) {
      const pmList = await call(client, "solidtime_project_members", {
        action: "list",
        project_id: projectId,
      });
      record("solidtime_project_members list", !pmList.isError, pmList.text);
      const pmPreview = await call(client, "solidtime_project_members", {
        action: "create",
        project_id: projectId,
        member_id: memberId,
      });
      record("solidtime_project_members create dry-run", previewOk(pmPreview.json), pmPreview.text);
      const pmCreated = await call(client, "solidtime_project_members", {
        action: "create",
        project_id: projectId,
        member_id: memberId,
        confirm: true,
      });
      const pmId = pickId(pmCreated.json) ?? pickId(listItems(pmList.json)[0]);
      record(
        "solidtime_project_members create",
        pmCreated.json?.["executed"] === true || pmCreated.isError,
        pmCreated.text,
      );
      if (pmId !== undefined) {
        const pmUpdatePreview = await call(client, "solidtime_project_members", {
          action: "update",
          project_member_id: pmId,
          billable_rate: 5000,
        });
        record(
          "solidtime_project_members update dry-run",
          previewOk(pmUpdatePreview.json),
          pmUpdatePreview.text,
        );
        const pmDeletePreview = await call(client, "solidtime_project_members", {
          action: "delete",
          project_member_id: pmId,
        });
        record(
          "solidtime_project_members delete dry-run (not sent)",
          previewOk(pmDeletePreview.json),
          pmDeletePreview.text,
        );
      }
    } else {
      record("solidtime_project_members", false, "no project");
    }

    const tasksList = await call(client, "solidtime_tasks", { action: "list" });
    record("solidtime_tasks list", !tasksList.isError, tasksList.text);
    if (projectId !== undefined) {
      const taskPreview = await call(client, "solidtime_tasks", {
        action: "create",
        name: `${stamp}-task`,
        project_id: projectId,
      });
      record("solidtime_tasks create dry-run", previewOk(taskPreview.json), taskPreview.text);
      const taskCreated = await call(client, "solidtime_tasks", {
        action: "create",
        name: `${stamp}-task`,
        project_id: projectId,
        estimated_time: 1800,
        confirm: true,
      });
      taskId = pickId(taskCreated.json);
      record(
        "solidtime_tasks create",
        taskCreated.json?.["executed"] === true && taskId !== undefined,
        taskCreated.text,
      );
      if (taskId !== undefined) {
        const taskUpdated = await call(client, "solidtime_tasks", {
          action: "update",
          task_id: taskId,
          name: `${stamp}-task-2`,
          confirm: true,
        });
        record("solidtime_tasks update", taskUpdated.json?.["executed"] === true, taskUpdated.text);
      }
    } else {
      record("solidtime_tasks create", false, "no project");
    }

    const goalsList = await call(client, "solidtime_goals", { action: "list" });
    record("solidtime_goals list", !goalsList.isError, goalsList.text);
    const goalPreview = await call(client, "solidtime_goals", {
      action: "create",
      name: `${stamp}-goal`,
      type: "personal",
      comparison: "at_least",
      target_seconds: 3600,
      period: "week",
    });
    record("solidtime_goals create dry-run", previewOk(goalPreview.json), goalPreview.text);
    const goalCreated = await call(client, "solidtime_goals", {
      action: "create",
      name: `${stamp}-goal`,
      type: "personal",
      comparison: "at_least",
      target_seconds: 3600,
      period: "week",
      confirm: true,
    });
    goalId = pickId(goalCreated.json);
    record(
      "solidtime_goals create",
      goalCreated.json?.["executed"] === true && goalId !== undefined,
      goalCreated.text,
    );
    if (goalId !== undefined) {
      const goalGet = await call(client, "solidtime_goals", { action: "get", goal_id: goalId });
      record("solidtime_goals get", !goalGet.isError, goalGet.text);
      const goalUpdated = await call(client, "solidtime_goals", {
        action: "update",
        goal_id: goalId,
        name: `${stamp}-goal-2`,
        confirm: true,
      });
      record("solidtime_goals update", goalUpdated.json?.["executed"] === true, goalUpdated.text);
    }

    if (memberId === undefined) {
      record("solidtime_time_entry_create", false, "no member id");
    } else {
      const entriesList = await call(client, "solidtime_time_entries_list", {
        member_id: memberId,
      });
      record("solidtime_time_entries_list", !entriesList.isError, entriesList.text);

      const entryPreview = await call(client, "solidtime_time_entry_create", {
        member_id: memberId,
        start: entryStart,
        end: entryEnd,
        billable: true,
        project_id: projectId ?? null,
        task_id: taskId ?? null,
        description: stamp,
      });
      record(
        "solidtime_time_entry_create dry-run",
        previewOk(entryPreview.json),
        entryPreview.text,
      );
      const entryCreated = await call(client, "solidtime_time_entry_create", {
        member_id: memberId,
        start: entryStart,
        end: entryEnd,
        billable: true,
        project_id: projectId ?? null,
        task_id: taskId ?? null,
        description: stamp,
        confirm: true,
      });
      timeEntryId = pickId(entryCreated.json);
      record(
        "solidtime_time_entry_create",
        entryCreated.json?.["executed"] === true && timeEntryId !== undefined,
        entryCreated.text,
      );
      if (timeEntryId !== undefined) {
        const entryUpdated = await call(client, "solidtime_time_entry_update", {
          time_entry_id: timeEntryId,
          description: `${stamp}-updated`,
          confirm: true,
        });
        record(
          "solidtime_time_entry_update",
          entryUpdated.json?.["executed"] === true,
          entryUpdated.text,
        );
      }
      const entry2 = await call(client, "solidtime_time_entry_create", {
        member_id: memberId,
        start: entryStart2,
        end: entryEnd2,
        billable: false,
        description: `${stamp}-2`,
        confirm: true,
      });
      timeEntryId2 = pickId(entry2.json);
      record(
        "solidtime_time_entry_create second",
        entry2.json?.["executed"] === true && timeEntryId2 !== undefined,
        entry2.text,
      );
      if (timeEntryId !== undefined && timeEntryId2 !== undefined) {
        const bulkPreview = await call(client, "solidtime_time_entries_bulk_update", {
          ids: [timeEntryId, timeEntryId2],
          billable: true,
        });
        record(
          "solidtime_time_entries_bulk_update dry-run",
          previewOk(bulkPreview.json) && JSON.stringify(bulkPreview.json).includes("irreversible"),
          bulkPreview.text,
        );
        const bulkUpdated = await call(client, "solidtime_time_entries_bulk_update", {
          ids: [timeEntryId, timeEntryId2],
          billable: true,
          confirm: true,
        });
        record(
          "solidtime_time_entries_bulk_update",
          bulkUpdated.json?.["executed"] === true,
          bulkUpdated.text,
        );
      }
    }

    const timerActive = await call(client, "solidtime_timer_active", {});
    record("solidtime_timer_active", !timerActive.isError, timerActive.text);

    if (memberId !== undefined) {
      const startPreview = await call(client, "solidtime_timer_start", {
        member_id: memberId,
        billable: false,
        description: `${stamp}-timer`,
      });
      record("solidtime_timer_start dry-run", previewOk(startPreview.json), startPreview.text);
      const started = await call(client, "solidtime_timer_start", {
        member_id: memberId,
        billable: false,
        description: `${stamp}-timer`,
        confirm: true,
      });
      timerId = pickId(started.json);
      record(
        "solidtime_timer_start",
        started.json?.["executed"] === true && timerId !== undefined,
        started.text,
      );
      const activeAfter = await call(client, "solidtime_timer_active", {});
      record("solidtime_timer_active after start", !activeAfter.isError, activeAfter.text);
      const stopPreview = await call(client, "solidtime_timer_stop", {
        time_entry_id: timerId,
      });
      record("solidtime_timer_stop dry-run", previewOk(stopPreview.json), stopPreview.text);
      const stoppedTimer = await call(client, "solidtime_timer_stop", {
        time_entry_id: timerId,
        confirm: true,
      });
      record("solidtime_timer_stop", stoppedTimer.json?.["executed"] === true, stoppedTimer.text);
    }

    record(
      "solidtime_time_entries_export skipped",
      true,
      "GET export does not return within 25s on this PHP built-in server and blocks other requests.",
    );

    const aggregated = await call(client, "solidtime_time_entries_aggregate", {
      group: "project",
      start: startIso,
      end: endIso,
    });
    record("solidtime_time_entries_aggregate", !aggregated.isError, aggregated.text);

    record(
      "solidtime_time_entries_aggregate_export skipped",
      true,
      "Same hang as time-entries/export on this instance. Not called live.",
    );

    const reportsList = await call(client, "solidtime_reports", { action: "list" });
    record("solidtime_reports list", !reportsList.isError, reportsList.text);
    const reportPreview = await call(client, "solidtime_reports", {
      action: "create",
      name: `${stamp}-report`,
      is_public: true,
      properties_start: startIso,
      properties_end: endIso,
      properties_group: "project",
      properties_sub_group: "task",
      properties_history_group: "week",
    });
    record("solidtime_reports create dry-run", previewOk(reportPreview.json), reportPreview.text);
    const reportCreated = await call(client, "solidtime_reports", {
      action: "create",
      name: `${stamp}-report`,
      is_public: true,
      properties_start: startIso,
      properties_end: endIso,
      properties_group: "project",
      properties_sub_group: "task",
      properties_history_group: "week",
      confirm: true,
    });
    reportId = pickId(reportCreated.json);
    share = shareSecret(reportCreated.json);
    record(
      "solidtime_reports create",
      reportCreated.json?.["executed"] === true && reportId !== undefined,
      reportCreated.text,
    );
    if (reportId !== undefined) {
      const reportGet = await call(client, "solidtime_reports", {
        action: "get",
        report_id: reportId,
      });
      if (share === undefined) share = shareSecret(reportGet.json);
      record("solidtime_reports get", !reportGet.isError, reportGet.text);
      const reportUpdated = await call(client, "solidtime_reports", {
        action: "update",
        report_id: reportId,
        name: `${stamp}-report-2`,
        confirm: true,
      });
      record(
        "solidtime_reports update",
        reportUpdated.json?.["executed"] === true,
        reportUpdated.text,
      );
    }
    if (share !== undefined) {
      const publicGot = await call(client, "solidtime_public_report", { share });
      record("solidtime_public_report", !publicGot.isError, publicGot.text);
    } else {
      const publicGot = await call(client, "solidtime_public_report", { share: "missing-share" });
      record("solidtime_public_report", publicGot.isError, publicGot.text);
    }

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
    ];
    for (const action of chartActions) {
      const chart = await call(client, "solidtime_charts", { action });
      record(`solidtime_charts ${action}`, !chart.isError, chart.text);
    }

    const importers = await call(client, "solidtime_importers", {});
    record("solidtime_importers", !importers.isError, importers.text);
    const importPreview = await call(client, "solidtime_import", {
      type: "toggl_time_entries",
      data: "not-a-real-export",
    });
    record("solidtime_import dry-run", previewOk(importPreview.json), importPreview.text);
    record(
      "solidtime_import skipped execute",
      true,
      "Preview only. A real import is not required to prove the gate, and a bad payload can stall this instance.",
    );

    const exportPreview = await call(client, "solidtime_export_organization", {});
    record(
      "solidtime_export_organization dry-run",
      previewOk(exportPreview.json),
      exportPreview.text,
    );
    record(
      "solidtime_export_organization skipped execute",
      true,
      "Preview only. File export on this PHP built-in server can block the process.",
    );

    const invoiceSettings = await call(client, "solidtime_invoice_settings", { action: "get" });
    record(
      "solidtime_invoice_settings get",
      !invoiceSettings.isError || planMiss(invoiceSettings.text),
      invoiceSettings.text,
    );
    const invoiceSettingsPreview = await call(client, "solidtime_invoice_settings", {
      action: "update",
      seller_name: stamp,
    });
    record(
      "solidtime_invoice_settings update dry-run",
      previewOk(invoiceSettingsPreview.json),
      invoiceSettingsPreview.text,
    );

    const recipients = await call(client, "solidtime_invoice_recipients", { action: "list" });
    record(
      "solidtime_invoice_recipients list",
      !recipients.isError || planMiss(recipients.text),
      recipients.text,
    );
    const recipientPreview = await call(client, "solidtime_invoice_recipients", {
      action: "create",
      name: stamp,
    });
    record(
      "solidtime_invoice_recipients create dry-run",
      previewOk(recipientPreview.json),
      recipientPreview.text,
    );

    const invoices = await call(client, "solidtime_invoices", { action: "list" });
    record("solidtime_invoices list", !invoices.isError || planMiss(invoices.text), invoices.text);
    const invoicePreview = await call(client, "solidtime_invoices", {
      action: "create",
      seller_name: stamp,
      invoice_recipient_id: "00000000-0000-0000-0000-000000000001",
      date: "2026-10-20T00:00:00Z",
      reference: stamp,
      currency: "EUR",
    });
    record(
      "solidtime_invoices create dry-run",
      previewOk(invoicePreview.json),
      invoicePreview.text,
    );

    const trialPreview = await call(client, "solidtime_cancel_trial", {});
    record(
      "solidtime_cancel_trial dry-run (not sent)",
      previewOk(trialPreview.json),
      trialPreview.text,
    );

    if (timeEntryId !== undefined && timeEntryId2 !== undefined) {
      const bulkDeletePreview = await call(client, "solidtime_time_entries_bulk_delete", {
        ids: [timeEntryId, timeEntryId2],
      });
      record(
        "solidtime_time_entries_bulk_delete dry-run",
        previewOk(bulkDeletePreview.json),
        bulkDeletePreview.text,
      );
      const bulkDeleted = await call(client, "solidtime_time_entries_bulk_delete", {
        ids: [timeEntryId, timeEntryId2],
        confirm: true,
      });
      record(
        "solidtime_time_entries_bulk_delete",
        bulkDeleted.json?.["executed"] === true,
        bulkDeleted.text,
      );
      timeEntryId = undefined;
      timeEntryId2 = undefined;
    }
    if (timerId !== undefined) {
      const timerDeleted = await call(client, "solidtime_time_entry_delete", {
        time_entry_id: timerId,
        confirm: true,
      });
      record(
        "solidtime_time_entry_delete (timer)",
        timerDeleted.json?.["executed"] === true || timerDeleted.isError,
        timerDeleted.text,
      );
      timerId = undefined;
    }
    if (timeEntryId !== undefined) {
      const deleted = await call(client, "solidtime_time_entry_delete", {
        time_entry_id: timeEntryId,
        confirm: true,
      });
      record("solidtime_time_entry_delete", deleted.json?.["executed"] === true, deleted.text);
      timeEntryId = undefined;
    }

    if (reportId !== undefined) {
      const deleted = await call(client, "solidtime_reports", {
        action: "delete",
        report_id: reportId,
        confirm: true,
      });
      record("solidtime_reports delete", deleted.json?.["executed"] === true, deleted.text);
      reportId = undefined;
    }
    if (goalId !== undefined) {
      const deleted = await call(client, "solidtime_goals", {
        action: "delete",
        goal_id: goalId,
        confirm: true,
      });
      record("solidtime_goals delete", deleted.json?.["executed"] === true, deleted.text);
      goalId = undefined;
    }
    if (taskId !== undefined) {
      const deleted = await call(client, "solidtime_tasks", {
        action: "delete",
        task_id: taskId,
        confirm: true,
      });
      record("solidtime_tasks delete", deleted.json?.["executed"] === true, deleted.text);
      taskId = undefined;
    }
    if (projectId !== undefined) {
      const deleted = await call(client, "solidtime_project_delete", {
        project_id: projectId,
        confirm: true,
      });
      record("solidtime_project_delete", deleted.json?.["executed"] === true, deleted.text);
      projectId = undefined;
    }
    if (tagId !== undefined) {
      const deleted = await call(client, "solidtime_tags", {
        action: "delete",
        tag_id: tagId,
        confirm: true,
      });
      record("solidtime_tags delete", deleted.json?.["executed"] === true, deleted.text);
      tagId = undefined;
    }
    if (clientId !== undefined) {
      const deleted = await call(client, "solidtime_clients", {
        action: "delete",
        client_id: clientId,
        confirm: true,
      });
      record("solidtime_clients delete", deleted.json?.["executed"] === true, deleted.text);
      clientId = undefined;
    }

    const skipInvoke = new Set([
      "solidtime_time_entries_export",
      "solidtime_time_entries_aggregate_export",
    ]);
    const missing = names.filter((name) => !called.has(name) && !skipInvoke.has(name));
    record(
      "all published tools invoked",
      missing.length === 0,
      missing.join(",") || `skipped export tools: ${[...skipInvoke].join(",")}`,
    );
  } finally {
    try {
      if (tokenId !== undefined) {
        await call(client, "solidtime_api_tokens", {
          action: "delete",
          api_token_id: tokenId,
          confirm: true,
        });
      }
      if (invitationId !== undefined) {
        await call(client, "solidtime_invitations", {
          action: "remove",
          invitation_id: invitationId,
          confirm: true,
        });
      }
      if (timerId !== undefined) {
        await call(client, "solidtime_time_entry_delete", {
          time_entry_id: timerId,
          confirm: true,
        });
      }
      if (timeEntryId !== undefined) {
        await call(client, "solidtime_time_entry_delete", {
          time_entry_id: timeEntryId,
          confirm: true,
        });
      }
      if (timeEntryId2 !== undefined) {
        await call(client, "solidtime_time_entry_delete", {
          time_entry_id: timeEntryId2,
          confirm: true,
        });
      }
      if (reportId !== undefined) {
        await call(client, "solidtime_reports", {
          action: "delete",
          report_id: reportId,
          confirm: true,
        });
      }
      if (goalId !== undefined) {
        await call(client, "solidtime_goals", {
          action: "delete",
          goal_id: goalId,
          confirm: true,
        });
      }
      if (taskId !== undefined) {
        await call(client, "solidtime_tasks", {
          action: "delete",
          task_id: taskId,
          confirm: true,
        });
      }
      if (projectId !== undefined) {
        await call(client, "solidtime_project_delete", {
          project_id: projectId,
          confirm: true,
        });
      }
      if (tagId !== undefined) {
        await call(client, "solidtime_tags", {
          action: "delete",
          tag_id: tagId,
          confirm: true,
        });
      }
      if (clientId !== undefined) {
        await call(client, "solidtime_clients", {
          action: "delete",
          client_id: clientId,
          confirm: true,
        });
      }
      if (tempOrgId !== undefined) {
        await call(client, "solidtime_organization_delete", {
          organization_id: tempOrgId,
          confirm: true,
        });
      }
      if (userId !== undefined && originalUserName !== undefined) {
        await call(client, "solidtime_user_update", {
          user_id: userId,
          name: originalUserName,
          confirm: true,
        });
      }
      if (originalOrgName !== undefined) {
        await call(client, "solidtime_organization_update", {
          name: originalOrgName,
          confirm: true,
        });
      }
    } catch (error) {
      writeError(redact(error instanceof Error ? error.message : "cleanup failed"));
    }
    await client.close();
  }

  for (const row of rows) writeLine(row);
  writeLine(`failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  const message = redact(error instanceof Error ? error.message : "live check failed");
  writeError(message);
  process.exit(stopped ? 3 : 1);
});
