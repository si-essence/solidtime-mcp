import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { ConnectorError } from "../src/errors.js";
import { AUTH_HEADER } from "../src/http.js";
import { createRuntime } from "../src/runtime.js";
import { z } from "zod";

const KEY = "super-secret/key+value=99";
const recordSchema = z.object({ id: z.string(), title: z.string() });

function runtimeFor(options: {
  fetchImpl: typeof fetch;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
}) {
  return createRuntime(
    loadConfig(
      { SOLIDTIME_API_TOKEN: KEY, SOLIDTIME_URL: "https://solidtime.test", ...options.env },
      [],
    ),
    {
      fetchImpl: options.fetchImpl,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("HttpClient", () => {
  it("sends Authorization Bearer, caches the parsed body, and does not put the token in the url", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      urls.push(requestUrl(input));
      return Promise.resolve(Response.json({ id: "rec-1", title: "Widget" }));
    });
    let now = 0;
    const runtime = runtimeFor({
      fetchImpl,
      env: { SOLIDTIME_CACHE_TTL_SEC: "30" },
      now: () => now,
    });
    const first = await runtime.client.getJson(
      { path: "api/v1/users/me", query: undefined, ttlSec: 30 },
      recordSchema,
    );
    const second = await runtime.client.getJson(
      { path: "api/v1/users/me", query: undefined, ttlSec: 30 },
      recordSchema,
    );
    expect(first).toEqual({ id: "rec-1", title: "Widget" });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get(AUTH_HEADER)).toBe(`Bearer ${KEY}`);
    expect(urls.join("\n")).not.toContain(KEY);
    expect(urls[0]).toContain("/api/v1/users/me");
    now = 31_000;
    await runtime.client.getJson(
      { path: "api/v1/users/me", query: undefined, ttlSec: 30 },
      recordSchema,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not spend the rate limit on a cache hit and blocks the next miss", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ id: "1", title: "A" })),
    );
    const runtime = runtimeFor({
      fetchImpl,
      env: { SOLIDTIME_PER_MINUTE: "1", SOLIDTIME_CACHE_TTL_SEC: "60" },
      now: () => 0,
    });
    await runtime.client.getJson(
      { path: "api/v1/users/me", query: undefined, ttlSec: 60 },
      recordSchema,
    );
    await runtime.client.getJson(
      { path: "api/v1/users/me", query: undefined, ttlSec: 60 },
      recordSchema,
    );
    await expect(
      runtime.client.getJson(
        { path: "api/v1/users/me/memberships", query: undefined, ttlSec: 60 },
        recordSchema,
      ),
    ).rejects.toMatchObject({ code: "rate_limit" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps 401, 404, 422, and 429", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes("unauthorized")) {
        return Promise.resolve(new Response(JSON.stringify({ message: "nope" }), { status: 401 }));
      }
      if (url.includes("missing")) {
        return Promise.resolve(new Response(JSON.stringify({ message: "gone" }), { status: 404 }));
      }
      if (url.includes("invalid")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message: "The given data was invalid.",
              errors: { email: ["The email field is required."] },
            }),
            { status: 422 },
          ),
        );
      }
      return Promise.resolve(
        new Response("slow", { status: 429, headers: { "retry-after": "7" } }),
      );
    });
    const runtime = runtimeFor({ fetchImpl });
    await expect(
      runtime.client.getJson(
        { path: "api/v1/unauthorized", query: undefined, ttlSec: 0 },
        z.unknown(),
      ),
    ).rejects.toMatchObject({ code: "upstream" });
    await expect(
      runtime.client.getJson({ path: "api/v1/missing", query: undefined, ttlSec: 0 }, z.unknown()),
    ).rejects.toMatchObject({ code: "not_found" });
    try {
      await runtime.client.postJson(
        { path: "api/v1/invalid", query: undefined, body: {} },
        z.unknown(),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorError);
      if (!(error instanceof ConnectorError)) throw error;
      expect(error.code).toBe("input");
      expect(error.message).toContain("422");
      expect(error.message).toContain("email");
    }
    try {
      await runtime.client.getJson(
        { path: "api/v1/slow", query: undefined, ttlSec: 0 },
        z.unknown(),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorError);
      if (!(error instanceof ConnectorError)) throw error;
      expect(error.code).toBe("rate_limit");
      expect(error.retryAfterSeconds).toBe(7);
      expect(error.message).toContain("Retry-After 7s");
    }
  });
});
