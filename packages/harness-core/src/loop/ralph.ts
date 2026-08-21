/**
 * Ralph Loop helpers for long-horizon continuation across fresh context windows.
 * Goal + filesystem state persist; model context is reinjected cleanly.
 */
export interface RalphState {
  iteration: number;
  maxIterations: number;
  goal: string;
  lastSummary?: string;
}

export function createRalphState(goal: string, maxIterations = 8): RalphState {
  return { iteration: 0, maxIterations, goal };
}

export function shouldRalphContinue(
  state: RalphState,
  modelSaysDone: boolean,
  verifyPassed: boolean,
): { continue: boolean; prompt?: string } {
  if (verifyPassed || modelSaysDone) {
    return { continue: false };
  }
  if (state.iteration >= state.maxIterations) {
    return { continue: false };
  }
  state.iteration += 1;
  return {
    continue: true,
    prompt:
      `Ralph continuation ${state.iteration}/${state.maxIterations}. ` +
      `Fresh context — read workspace state from disk and continue.\nGoal: ${state.goal}` +
      (state.lastSummary ? `\nLast summary: ${state.lastSummary}` : ""),
  };
}
