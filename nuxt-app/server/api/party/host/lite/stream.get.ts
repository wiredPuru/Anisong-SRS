import { toLiteHost } from "../../../../utils/partyLiteGame.ts";
import { refreshLiteMatchCount } from "../../../../utils/partyLiteStore.ts";
import { streamLiteView } from "../../../../utils/partyLiteStream.ts";

export default defineEventHandler((event) => {
  refreshLiteMatchCount();
  return streamLiteView(event, toLiteHost);
});
