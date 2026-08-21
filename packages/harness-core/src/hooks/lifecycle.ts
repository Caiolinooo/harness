export type HookPoint =
  | "before_llm"
  | "after_llm"
  | "before_tool"
  | "after_tool"
  | "before_phase"
  | "after_phase"
  | "on_error"
  | "on_exit_attempt";

export type HookHandler = (ctx: Record<string, unknown>) => Promise<void> | void;

/**
 * Deterministic lifecycle hooks (auth, policy, instrumentation, Ralph continuation).
 */
export class LifecycleHooks {
  private handlers = new Map<HookPoint, HookHandler[]>();

  on(point: HookPoint, handler: HookHandler): void {
    const list = this.handlers.get(point) ?? [];
    list.push(handler);
    this.handlers.set(point, list);
  }

  async emit(point: HookPoint, ctx: Record<string, unknown> = {}): Promise<void> {
    const list = this.handlers.get(point) ?? [];
    for (const h of list) {
      await h(ctx);
    }
  }
}

/**
 * Ralph Loop: intercept premature exit and reinject goal with fresh context.
 */
export function installRalphLoop(
  hooks: LifecycleHooks,
  opts: { maxContinuations: number; goal: string },
): { continuations: () => number } {
  let continuations = 0;
  hooks.on("on_exit_attempt", async (ctx) => {
    if (continuations >= opts.maxContinuations) return;
    const complete = ctx.complete === true;
    if (complete) return;
    continuations += 1;
    ctx.continue = true;
    ctx.reinjectPrompt = `Continue working toward the goal. Do not stop until done.\nGoal: ${opts.goal}`;
  });
  return { continuations: () => continuations };
}
