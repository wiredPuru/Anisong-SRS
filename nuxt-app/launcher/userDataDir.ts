import { join } from "node:path";

export function resolveUserDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
): string {
  if (platform === "win32") {
    const appData = env.APPDATA ?? join(homeDir, "AppData/Roaming");
    return join(appData, "gaq-srs");
  }
  if (platform === "darwin") {
    return join(homeDir, "Library/Application Support/gaq-srs");
  }
  const dataHome = env.XDG_DATA_HOME ?? join(homeDir, ".local/share");
  return join(dataHome, "gaq-srs");
}
