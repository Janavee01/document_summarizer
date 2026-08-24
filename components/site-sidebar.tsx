"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, History, Menu, ScanText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Summarizer",
    description: "Upload & summarize",
    icon: FileText,
  },
  {
    href: "/history",
    label: "Summary history",
    description: "Your past summaries",
    icon: History,
  },
];

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      aria-label="Document Intelligence home"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal text-white">
        <ScanText aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-ink">
        Document Intelligence
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
              isActive
                ? "border-teal/25 bg-teal-soft text-teal"
                : "border-transparent text-ink-soft hover:border-line hover:bg-paper-raised hover:text-ink"
            )}
          >
            <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            <span className="min-w-0">
              {item.label}
              <span
                className={cn(
                  "block truncate text-xs font-normal",
                  isActive ? "text-teal/80" : "text-ink-faint"
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes (covers browser
  // back/forward, which bypass the link onClick handlers). Deferred so we
  // don't call setState synchronously inside the effect.
  useEffect(() => {
    const timer = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Close on Escape and lock background scrolling while open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-paper-raised text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        hidden={!isOpen}
        className="fixed inset-0 z-50 lg:hidden"
      >
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 h-full w-full bg-ink/40"
        />

        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-paper transition-transform duration-200 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <BrandMark />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-paper-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks onNavigate={() => setIsOpen(false)} />
          </div>

          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-faint">
            Summaries are stored privately on this device.
          </p>
        </aside>
      </div>

      {/* Desktop vertical rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-paper lg:flex">
        <div className="border-b border-line px-4 py-4">
          <BrandMark />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </div>

        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-faint">
          Summaries are stored privately on this device.
        </p>
      </aside>
    </>
  );
}
