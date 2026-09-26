import { startSelfUpdate } from "../../utils/selfUpdate.ts";

export default defineEventHandler(async () => {
  const { public: config } = useRuntimeConfig();
  return await startSelfUpdate(config.appVersion);
});
