import { z } from "zod";
import { brandBaseUrl, brandSecret, type BaseUrl, type Secret } from "./brand.js";
import {
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  DEFAULT_BASE_URL,
  DEFAULT_PER_MINUTE,
} from "./constants.js";
import { ConnectorError } from "./errors.js";
import { fixedError } from "./zod-messages.js";

const invalid = fixedError("invalid");

const EnvSchema = z.object({
  SOLIDTIME_API_TOKEN: z
    .string({ error: invalid })
    .trim()
    .min(8, { error: invalid })
    .max(4096, { error: invalid })
    .optional(),
  SOLIDTIME_URL: z.url({ error: invalid }).optional(),
  SOLIDTIME_ORGANIZATION_ID: z
    .string({ error: invalid })
    .trim()
    .min(1, { error: invalid })
    .max(64, { error: invalid })
    .optional(),
  SOLIDTIME_ALLOW_WRITES: z.string({ error: invalid }).optional(),
  SOLIDTIME_PER_MINUTE: z
    .string({ error: invalid })
    .regex(/^[0-9]+$/, { error: invalid })
    .optional(),
  SOLIDTIME_TIMEOUT_MS: z
    .string({ error: invalid })
    .regex(/^[0-9]+$/, { error: invalid })
    .optional(),
  SOLIDTIME_CONTACT: z
    .string({ error: invalid })
    .trim()
    .min(1, { error: invalid })
    .max(120, { error: invalid })
    .optional(),
  MCP_TRANSPORT: z.enum(["stdio", "http"], { error: invalid }).optional(),
  PORT: z
    .string({ error: invalid })
    .regex(/^[0-9]+$/, { error: invalid })
    .optional(),
  SOLIDTIME_CACHE_TTL_SEC: z
    .string({ error: invalid })
    .regex(/^[0-9]+$/, { error: invalid })
    .optional(),
});

export interface Config {
  apiKey: Secret | undefined;
  baseUrl: BaseUrl;
  organizationId: string | undefined;
  allowWrites: boolean;
  perMinute: number;
  timeoutMs: number;
  contact: string;
  transport: "stdio" | "http";
  port: number;
  cacheTtlSec: number;
  userAgent: string;
}

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function blank(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  return blank(env[name]);
}

function issueSummary(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path =
        issue.path.length === 0 ? "(root)" : issue.path.map((part) => String(part)).join(".");
      return `${path} (${issue.code})`;
    })
    .join("; ");
}

function boundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): number {
  if (raw === undefined) return fallback;
  const parsed = z.number().int().min(min).max(max).safeParse(Number(raw));
  if (!parsed.success) {
    throw new ConnectorError("config", `Invalid environment: ${field} (out_of_range).`);
  }
  return parsed.data;
}

function userAgentFor(contact: string): string {
  const clean = contact
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120);
  return `${CONNECTOR_NAME}/${CONNECTOR_VERSION} (${clean.length > 0 ? clean : "contact@example.com"})`;
}

function normalizeBaseUrl(value: string): BaseUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_URL (invalid_url).");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_URL (invalid_url).");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_URL (userinfo).");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_URL (query_or_hash).");
  }
  let href = value.replace(/\/+$/, "");
  href = href.replace(/\/api$/i, "");
  href = href.replace(/\/+$/, "");
  return brandBaseUrl(href);
}

export function loadConfig(env: NodeJS.ProcessEnv, argv: readonly string[]): Config {
  const parsed = EnvSchema.safeParse({
    SOLIDTIME_API_TOKEN: read(env, "SOLIDTIME_API_TOKEN"),
    SOLIDTIME_URL: read(env, "SOLIDTIME_URL"),
    SOLIDTIME_ORGANIZATION_ID: read(env, "SOLIDTIME_ORGANIZATION_ID"),
    SOLIDTIME_ALLOW_WRITES: read(env, "SOLIDTIME_ALLOW_WRITES"),
    SOLIDTIME_PER_MINUTE: read(env, "SOLIDTIME_PER_MINUTE"),
    SOLIDTIME_TIMEOUT_MS: read(env, "SOLIDTIME_TIMEOUT_MS"),
    SOLIDTIME_CONTACT: read(env, "SOLIDTIME_CONTACT"),
    MCP_TRANSPORT: read(env, "MCP_TRANSPORT"),
    PORT: read(env, "PORT"),
    SOLIDTIME_CACHE_TTL_SEC: read(env, "SOLIDTIME_CACHE_TTL_SEC"),
  });
  if (!parsed.success) {
    throw new ConnectorError("config", `Invalid environment: ${issueSummary(parsed.error)}.`);
  }

  const data = parsed.data;
  const apiKey =
    data.SOLIDTIME_API_TOKEN === undefined ? undefined : brandSecret(data.SOLIDTIME_API_TOKEN);
  const baseUrl = normalizeBaseUrl(data.SOLIDTIME_URL ?? DEFAULT_BASE_URL);
  const contact = data.SOLIDTIME_CONTACT ?? "contact@example.com";
  if (hasControlChar(contact)) {
    throw new ConnectorError(
      "config",
      "Invalid environment: SOLIDTIME_CONTACT (control_character).",
    );
  }
  const userAgent = userAgentFor(contact);
  if (apiKey !== undefined && baseUrl.includes(apiKey)) {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_URL (contains_secret).");
  }
  if (apiKey !== undefined && (contact.includes(apiKey) || userAgent.includes(apiKey))) {
    throw new ConnectorError("config", "Invalid environment: SOLIDTIME_CONTACT (contains_secret).");
  }
  if (
    apiKey !== undefined &&
    data.SOLIDTIME_ORGANIZATION_ID !== undefined &&
    data.SOLIDTIME_ORGANIZATION_ID.includes(apiKey)
  ) {
    throw new ConnectorError(
      "config",
      "Invalid environment: SOLIDTIME_ORGANIZATION_ID (contains_secret).",
    );
  }

  const envTransport = data.MCP_TRANSPORT ?? "stdio";
  const transport = argv.includes("--http") ? "http" : envTransport;
  const allowWrites = data.SOLIDTIME_ALLOW_WRITES === "true";

  return {
    apiKey,
    baseUrl,
    organizationId: data.SOLIDTIME_ORGANIZATION_ID,
    allowWrites,
    perMinute: boundedInt(
      data.SOLIDTIME_PER_MINUTE,
      DEFAULT_PER_MINUTE,
      1,
      10_000,
      "SOLIDTIME_PER_MINUTE",
    ),
    timeoutMs: boundedInt(data.SOLIDTIME_TIMEOUT_MS, 20_000, 100, 120_000, "SOLIDTIME_TIMEOUT_MS"),
    contact,
    transport,
    port: boundedInt(data.PORT, 3000, 1, 65_535, "PORT"),
    cacheTtlSec: boundedInt(data.SOLIDTIME_CACHE_TTL_SEC, 60, 0, 86_400, "SOLIDTIME_CACHE_TTL_SEC"),
    userAgent,
  };
}
