import { toLiteDisplay } from "../../../../utils/partyLiteGame.ts";
import { streamLiteView } from "../../../../utils/partyLiteStream.ts";

export default defineEventHandler((event) => streamLiteView(event, toLiteDisplay));
