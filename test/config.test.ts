import { describe, expect, it } from "vitest";
import { CONNECTOR_NAME, CONNECTOR_VERSION, DEFAULT_BASE_URL } from "../src/constants.js";
import { loadConfig } from "../src/config.js";
import { ConnectorError } from "../src/errors.js";

const KEY = "super-secret/key+value=99";

function messageOf(error: unknown): string {
  expect(error).toBeInstanceOf(ConnectorError);
  if (!(error instanceof ConnectorError)) throw error;
  return error.message;
}

function catchError(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig({}, []);
    expect(config.apiKey).toBeUndefined();
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.organizationId).toBeUndefined();
    expect(config.allowWrites).toBe(false);
    expect(config.perMinute).toBe(200);
    expect(config.timeoutMs).toBe(20_000);
    expect(config.contact).toBe("contact@example.com");
    expect(config.transport).toBe("stdio");
    expect(config.port).toBe(3000);
    expect(config.cacheTtlSec).toBe(60);
    expect(config.userAgent).toBe(`${CONNECTOR_NAME}/${CONNECTOR_VERSION} (contact@example.com)`);
  });

  it("lets --http override the transport", () => {
    expect(loadConfig({ MCP_TRANSPORT: "stdio" }, ["node", "app", "--http"]).transport).toBe(
      "http",
    );
    expect(loadConfig({ MCP_TRANSPORT: "http" }, []).transport).toBe("http");
  });

  it("strips a trailing /api from the base url", () => {
    const config = loadConfig({ SOLIDTIME_URL: "http://127.0.0.1:8088/api/" }, []);
    expect(config.baseUrl).toBe("http://127.0.0.1:8088");
  });

  it("enables writes only when SOLIDTIME_ALLOW_WRITES is the literal true", () => {
    expect(loadConfig({ SOLIDTIME_ALLOW_WRITES: "true" }, []).allowWrites).toBe(true);
    expect(loadConfig({ SOLIDTIME_ALLOW_WRITES: "yes" }, []).allowWrites).toBe(false);
  });

  it("reports invalid fields without the rejected value or the api token", () => {
    const message = messageOf(
      catchError(() =>
        loadConfig({ SOLIDTIME_API_TOKEN: KEY, PORT: "nope", MCP_TRANSPORT: "sse" }, []),
      ),
    );
    expect(message).toContain("PORT");
    expect(message).toContain("MCP_TRANSPORT");
    expect(message).not.toContain(KEY);
    expect(message).not.toContain("nope");
    expect(message).not.toContain("sse");
  });

  it("rejects a short api token without echoing it", () => {
    const message = messageOf(catchError(() => loadConfig({ SOLIDTIME_API_TOKEN: "short" }, [])));
    expect(message).toContain("SOLIDTIME_API_TOKEN");
    expect(message).not.toContain("short");
  });

  it("rejects a base url or contact that contains the api token", () => {
    const inUrl = messageOf(
      catchError(() =>
        loadConfig(
          { SOLIDTIME_API_TOKEN: KEY, SOLIDTIME_URL: `https://example.invalid/${KEY}` },
          [],
        ),
      ),
    );
    expect(inUrl).toContain("contains_secret");
    expect(inUrl).not.toContain(KEY);

    const inContact = messageOf(
      catchError(() => loadConfig({ SOLIDTIME_API_TOKEN: KEY, SOLIDTIME_CONTACT: KEY }, [])),
    );
    expect(inContact).toContain("SOLIDTIME_CONTACT");
    expect(inContact).not.toContain(KEY);
  });

  it("rejects userinfo and query strings on the base url", () => {
    const userinfo = messageOf(
      catchError(() => loadConfig({ SOLIDTIME_URL: "https://user:pass@example.invalid" }, [])),
    );
    expect(userinfo).toContain("userinfo");
    expect(userinfo).not.toContain("pass");

    const query = messageOf(
      catchError(() =>
        loadConfig({ SOLIDTIME_URL: `https://example.invalid/v1?api_key=${KEY}` }, []),
      ),
    );
    expect(query).toContain("SOLIDTIME_URL");
    expect(query).not.toContain(KEY);
  });
});
