import { listStoryChars } from "../../../utils/kanjiStories.ts";

export default defineEventHandler(() => ({ chars: listStoryChars() }));
