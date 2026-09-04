import { getUpdateStatus } from "../utils/version.ts";

export default defineEventHandler(async () => {
  const { public: config } = useRuntimeConfig();
  return await getUpdateStatus(config.appVersion);
});
