"use client";

import { useEffect, useState } from "react";

interface CreepingProgressOptions {
  /** Value the bar starts from when activated. */
  start?: number;
  /** Value the creep asymptotically approaches while awaiting. */
  ceiling?: number;
  /** Tick interval in milliseconds. */
  intervalMs?: number;
}

/*
 * fetch() gives no progress events for JSON requests, so a bar driven by
 * checkpoints alone freezes during the actual await and then jumps to 100%.
 * While `active`, this hook eases the value toward `ceiling` (never past it,
 * so it never lies about being done); callers just flip `active` when the
 * real work settles.
 */
export function useCreepingProgress(
  active: boolean,
  { start = 8, ceiling = 92, intervalMs = 400 }: CreepingProgressOptions = {}
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;

    // Deferred so we don't call setState synchronously inside the effect
    // (cascading-render rule). The one-frame delay is invisible under the
    // bar's own 500ms CSS transition.
    const resetTimer = window.setTimeout(() => setProgress(start), 0);

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= ceiling) return ceiling;

        // Ease-out: big steps early, tiny steps near the ceiling. Steps are
        // floored to whole percents so the bar only ever shows integers.
        const step = Math.max(1, Math.round((ceiling - current) * 0.05));

        return Math.min(ceiling, current + step);
      });
    }, intervalMs);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
    };
  }, [active, start, ceiling, intervalMs]);

  return progress;
}
