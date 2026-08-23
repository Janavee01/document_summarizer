interface LoadingProgressProps {
  label: string;
  progress: number;
}

export function LoadingProgress({
  label,
  progress,
}: LoadingProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label} ${clampedProgress}%`}
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">{label}</p>
        <span className="text-xs font-medium text-zinc-500">
          {clampedProgress}%
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
