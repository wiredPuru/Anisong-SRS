import { getClipSource } from "../../../utils/mediaLibrary.ts";

export default defineEventHandler(() => ({ clipSource: getClipSource() }));
