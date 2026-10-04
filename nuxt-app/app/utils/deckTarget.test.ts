import { describe, expect, it, vi } from "vitest";
import { deckTargetProblem, NO_DECK_TARGET, resolveDeckTarget, type DeckTarget } from "./deckTarget";

describe("deckTargetProblem", () => {
  it("only a new deck with a blank name is a problem", () => {
    expect(deckTargetProblem(NO_DECK_TARGET)).toBeNull();
    expect(deckTargetProblem({ mode: "existing", deckId: 3 })).toBeNull();
    expect(deckTargetProblem({ mode: "new", name: "  " })).not.toBeNull();
    expect(deckTargetProblem({ mode: "new", name: "Ecchi" })).toBeNull();
  });
});

describe("resolveDeckTarget", () => {
  it("returns no id for no deck, and the id for an existing one, without creating", async () => {
    const create = vi.fn();
    expect(await resolveDeckTarget(NO_DECK_TARGET, create, vi.fn())).toBeNull();
    expect(await resolveDeckTarget({ mode: "existing", deckId: 7 }, create, vi.fn())).toBe(7);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new deck once, trimmed, and adopts it so a second resolve reuses it", async () => {
    const create = vi.fn().mockResolvedValue(42);
    let current: DeckTarget = { mode: "new", name: "  Ecchi  " };
    const adopt = (next: DeckTarget) => { current = next; };
    expect(await resolveDeckTarget(current, create, adopt)).toBe(42);
    expect(create).toHaveBeenCalledWith("Ecchi");
    expect(current).toEqual({ mode: "existing", deckId: 42 });
    expect(await resolveDeckTarget(current, create, adopt)).toBe(42);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed create and adopts nothing", async () => {
    const adopt = vi.fn();
    await expect(resolveDeckTarget({ mode: "new", name: "X" }, vi.fn().mockRejectedValue(new Error("exists")), adopt)).rejects.toThrow("exists");
    expect(adopt).not.toHaveBeenCalled();
  });
});
