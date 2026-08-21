import { describe, expect, it } from "vitest";
import { createRalphState, shouldRalphContinue } from "./ralph.js";

describe("Ralph loop", () => {
  it("continues until max iterations or done", () => {
    const state = createRalphState("ship feature", 2);
    const first = shouldRalphContinue(state, false, false);
    expect(first.continue).toBe(true);
    const second = shouldRalphContinue(state, false, false);
    expect(second.continue).toBe(true);
    const third = shouldRalphContinue(state, false, false);
    expect(third.continue).toBe(false);
    expect(shouldRalphContinue(state, true, false).continue).toBe(false);
  });
});
