import { ConnectorError } from "./errors.js";
import { OPERATIONS, type Operation } from "./operations.js";

export function requireOp(
  tool: string,
  action: string | undefined,
  pathMatch?: (path: string) => boolean,
): Operation {
  const found = OPERATIONS.find((operation) => {
    if (operation.tool !== tool) return false;
    if (operation.action !== action) return false;
    if (pathMatch !== undefined && !pathMatch(operation.path)) return false;
    return true;
  });
  if (found === undefined) {
    throw new ConnectorError("config", `Unknown Solidtime operation for ${tool}.`);
  }
  return found;
}
