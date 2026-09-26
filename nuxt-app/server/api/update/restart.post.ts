import { installStagedUpdate, relaunchAndExit } from "../../utils/selfUpdate.ts";

export default defineEventHandler(async () => {
  const { public: config } = useRuntimeConfig();
  const result = await installStagedUpdate(config.appVersion);
  if (result.ok) relaunchAndExit();
  return result;
});
