"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { parseShareLink } from "@/lib/share";
import type { Summary } from "@/types/summary";
import { SummaryView } from "@/components/summary/summary-view";

// The summary payload lives in the URL fragment, which only exists in the
// browser. `null` means "not yet hydrated" (rendered as loading); an empty
// string means there is no payload at all.
function subscribeToHashChange(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

function getServerHash(): null {
  return null;
}

export default function SharedSummaryPage() {
  const hash = useSyncExternalStore(
    subscribeToHashChange,
    getHash,
    getServerHash
  );

  const summary = useMemo<Summary | null>(
    () => (hash === null ? null : parseShareLink(hash)),
    [hash]
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 font-sans text-zinc-950">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Shared summary
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            A document summary generated with Document Intelligence.
          </p>
        </div>

        {hash === null && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600"
          >
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Opening shared summary…
          </div>
        )}

        {hash !== null && !summary && (
          <div className="space-y-4">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              />
              <p className="text-sm text-red-700">
                This shared summary link is invalid or incomplete. Ask the
                sender to share it again.
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Summarize your own document
            </Link>
          </div>
        )}

        {summary && (
          <>
            <SummaryView summary={summary} />
            <hr className="my-6 border-zinc-200" />
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Summarize your own document
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
