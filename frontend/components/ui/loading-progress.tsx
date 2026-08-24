interface LoadingProgressProps {
  label: string;
  progress: number;
}

export function LoadingProgress({
  label,
  progress,
}: LoadingProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  // Progress is displayed strictly as an integer percentage.
  const displayProgress = Math.round(clampedProgress);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label} ${displayProgress}%`}
      className="rounded-lg border border-line bg-paper px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{label}</p>
        <span className="font-mono text-xs font-medium tabular-nums text-ink-faint">
          {displayProgress}%
        </span>
      </div>

      <div className="scan-track mt-2.5" aria-hidden="true">
        <div
          className="scan-fill"
          style={{ width: `${displayProgress}%` }}
        />
        {clampedProgress < 100 && (
          <div className="scan-sweep" />
        )}
      </div>
    </div>
  );
}
