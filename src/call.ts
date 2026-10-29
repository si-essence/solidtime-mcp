import { CONNECTOR_NAME } from "./constants.js";
import { ConnectorError } from "./errors.js";
import { jsonValueSchema, fillOpenApiPath, toResult } from "./json.js";
import type { QueryMap } from "./http.js";
import type { Operation } from "./operations.js";
import type { Runtime } from "./runtime.js";
import { withWrite } from "./write-gate.js";

export interface CallOptions {
  readonly params?: Readonly<Record<string, string | number>> | undefined;
  readonly query?: QueryMap | undefined;
  readonly body?: unknown;
  readonly confirm?: true | undefined;
  readonly summary?: string | undefined;
  readonly warnings?: readonly string[] | undefined;
  readonly optionalAuth?: boolean | undefined;
  readonly extraHeaders?: Readonly<Record<string, string>> | undefined;
}

export async function callSolidtime(
  runtime: Runtime,
  operation: Operation,
  options: CallOptions = {},
): Promise<Record<string, unknown>> {
  const path = fillOpenApiPath(operation.path, options.params ?? {});
  const query = options.query;
  const body = options.body;
  const summary = options.summary ?? operation.summary;
  const warnings = options.warnings ?? [];

  const run = async (): Promise<Record<string, unknown>> => {
    return execute(
      runtime,
      operation,
      path,
      query,
      body,
      options.optionalAuth === true,
      options.extraHeaders,
    );
  };

  if (!operation.write) return run();
  return withWrite(
    runtime,
    options.confirm,
    {
      method: operation.method,
      path,
      query,
      body,
      summary,
      warnings,
    },
    run,
  );
}

/** Map a missing Professional route (HTTP 404 API resource not found) to a plan error. */
export async function callProfessional(
  runtime: Runtime,
  operation: Operation,
  options: CallOptions = {},
): Promise<Record<string, unknown>> {
  try {
    return await callSolidtime(runtime, operation, options);
  } catch (error) {
    if (
      error instanceof ConnectorError &&
      error.code === "not_found" &&
      /API resource not found/i.test(error.message)
    ) {
      throw new ConnectorError(
        "upstream",
        `${CONNECTOR_NAME} HTTP 404 not available on this plan or instance: API resource not found`,
      );
    }
    throw error;
  }
}

async function execute(
  runtime: Runtime,
  operation: Operation,
  path: string,
  query: QueryMap | undefined,
  body: unknown,
  optionalAuth: boolean,
  extraHeaders: Readonly<Record<string, string>> | undefined,
): Promise<Record<string, unknown>> {
  if (operation.kind === "text") {
    const text = await runtime.client.getText({ path, query, ttlSec: runtime.cacheTtlSec });
    return { content_type: text.contentType, text: text.text };
  }
  if (operation.method === "GET") {
    const getter = optionalAuth
      ? runtime.client.getJsonOptionalAuth.bind(runtime.client)
      : runtime.client.getJson.bind(runtime.client);
    const json = await getter(
      extraHeaders === undefined
        ? { path, query, ttlSec: runtime.cacheTtlSec }
        : { path, query, ttlSec: runtime.cacheTtlSec, extraHeaders },
      jsonValueSchema,
    );
    return toResult(json);
  }
  if (operation.method === "POST") {
    const json = await runtime.client.postJson({ path, query, body: body ?? {} }, jsonValueSchema);
    return toResult(json);
  }
  if (operation.method === "PUT") {
    const json = await runtime.client.putJson({ path, query, body: body ?? {} }, jsonValueSchema);
    return toResult(json);
  }
  if (operation.method === "PATCH") {
    const json = await runtime.client.patchJson({ path, query, body: body ?? {} }, jsonValueSchema);
    return toResult(json);
  }
  if (body !== undefined) {
    const json = await runtime.client.deleteJson({ path, query, body }, jsonValueSchema);
    return toResult(json);
  }
  const sent = await runtime.client.delete({ path, query });
  return { status: sent.status, body: sent.body };
}
