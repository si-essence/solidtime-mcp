import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/log.js";
import { redact, redactUnknown } from "../src/redact.js";
import { createRuntime } from "../src/runtime.js";
import { connectServer } from "./mcp.js";
import { readToolText } from "./result.js";

const KEY = "super-secret/key+value=99";
const ENCODED = encodeURIComponent(KEY);

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function assertNoKey(label: string, text: string): void {
  expect(text, label).not.toContain(KEY);
  expect(text, label).not.toContain(ENCODED);
}

describe("redact", () => {
  it("strips the secret, its url encoding, query params, and bearer tokens", () => {
    const raw = [
      `key=${KEY}`,
      `encoded=${ENCODED}`,
      `https://upstream.test/lookup?api_key=${KEY}&x=1`,
      `Authorization: Bearer ${KEY}`,
    ].join("\n");
    const cleaned = redact(raw, [KEY]);
    assertNoKey("redact", cleaned);
    expect(cleaned).toContain("api_key=[redacted]");
    expect(cleaned).toContain("Bearer [redacted]");
  });

  it("redacts nested token fields", () => {
    const cleaned = JSON.stringify(
      redactUnknown({ access_token: KEY, title: `see ${KEY}` }, [KEY]),
    );
    assertNoKey("nested", cleaned);
    expect(cleaned).toContain("[redacted]");
  });

  it("redacts secrets in tool errors and never logs the raw token", async () => {
    const lines: string[] = [];
    const consoleLines: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      consoleLines.push(
        args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
      );
    });
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      assertNoKey("request url", requestUrl(input));
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
      return Promise.resolve(new Response(`fail ${KEY}`, { status: 500 }));
    });
    const runtime = createRuntime(
      loadConfig(
        {
          SOLIDTIME_API_TOKEN: KEY,
          SOLIDTIME_URL: "https://solidtime.test",
          SOLIDTIME_CACHE_TTL_SEC: "0",
        },
        [],
      ),
      {
        fetchImpl,
        logger: createLogger([KEY], (line) => {
          lines.push(line);
        }),
      },
    );
    const { client, close } = await connectServer(runtime);
    try {
      const result = readToolText(await client.callTool({ name: "solidtime_me", arguments: {} }));
      expect(result.isError).toBe(true);
      assertNoKey("tool", result.text);
      for (const line of lines) assertNoKey("log", line);
      assertNoKey("stderr", consoleLines.join("\n"));
    } finally {
      spy.mockRestore();
      await close();
    }
  });
});
