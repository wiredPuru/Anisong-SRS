export function createReviewSubmission() {
  let busy = false;
  let saved = false;
  let advanced = false;
  return {
    async saveOnce(save: () => Promise<boolean>): Promise<"saved" | "failed" | "ignored"> {
      if (busy || saved) return "ignored";
      busy = true;
      try {
        saved = await save();
        return saved ? "saved" : "failed";
      } finally {
        busy = false;
      }
    },

    async advanceOnce(advance: () => Promise<boolean>): Promise<boolean> {
      if (busy || !saved || advanced) return false;
      busy = true;
      try {
        advanced = await advance();
        return advanced;
      } finally {
        busy = false;
      }
    },

    async run(save: () => Promise<boolean>, advance: () => Promise<boolean>) {
      await this.saveOnce(save);
      if (saved) await this.advanceOnce(advance);
    },
  };
}
