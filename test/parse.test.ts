import { describe, expect, it } from "vitest";
import { isAbsoluteFsPath, stripPathsInText, stripServerPaths } from "../src/parse.js";

describe("stripServerPaths", () => {
  it("drops absolute filesystem paths and path-bearing keys", () => {
    expect(isAbsoluteFsPath("/tmp/grocy.db")).toBe(true);
    expect(isAbsoluteFsPath("note.txt")).toBe(false);
    const stripped = stripServerPaths({
      name: "Milk",
      leak: "/tmp/grocy/data.db",
      picture: "/var/www/data.jpg",
      filename: "/opt/grocy/x.png",
      keep: "shelf.png",
    });
    expect(stripped).toEqual({ name: "Milk", keep: "shelf.png" });
    expect(stripPathsInText("see /tmp/secret.db here")).toContain("[omitted-path]");
  });
});
