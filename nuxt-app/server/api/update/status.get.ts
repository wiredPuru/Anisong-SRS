import { getSelfUpdateStatus } from "../../utils/selfUpdate.ts";

export default defineEventHandler(async () => {
  const { public: config } = useRuntimeConfig();
  return await getSelfUpdateStatus(config.appVersion);
});
