import { accessSync, constants, statSync } from "node:fs";
import { isPathWithinLibrary } from "./mediaLibrary.ts";

export function localMediaAvailable(path: unknown): boolean {
  if (typeof path !== "string" || !path || !isPathWithinLibrary(path)) return false;
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
