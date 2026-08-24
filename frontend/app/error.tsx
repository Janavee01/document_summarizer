"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="card-index w-full max-w-md space-y-4 p-8">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-danger"
          />
          <div>
            <p className="text-sm font-semibold text-danger">
              Something went wrong on this page.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              An unexpected error occurred. Your saved history is unaffected —
              please try again.
            </p>
            {error.digest ? (
              <p className="mt-2 font-mono text-xs text-ink-faint">
                Error ID: {error.digest}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => retry()}
          className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
