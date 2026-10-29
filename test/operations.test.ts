import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATIONS, openApiKeys, toolNames } from "../src/operations.js";

describe("OpenAPI coverage", () => {
  it("covers every path and operation in solidtime.openapi.json", () => {
    const spec = JSON.parse(
      readFileSync((existsSync(new URL("../solidtime.openapi.json", import.meta.url)) ? new URL("../solidtime.openapi.json", import.meta.url) : new URL("./fixtures/solidtime.routes.json", import.meta.url)), "utf8"),
    ) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const specKeys: string[] = [];
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const method of Object.keys(ops)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          specKeys.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    specKeys.sort();
    expect(openApiKeys()).toEqual(specKeys);
    expect(Object.keys(spec.paths)).toHaveLength(54);
    expect(specKeys).toHaveLength(81);
    expect(OPERATIONS.filter((operation) => operation.catalog === "openapi")).toHaveLength(81);
    expect(OPERATIONS).toHaveLength(99);
    const names = toolNames();
    expect(names.length).toBeGreaterThanOrEqual(40);
    expect(names.length).toBeLessThanOrEqual(80);
  });
});
