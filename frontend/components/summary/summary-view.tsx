import { CheckCircle2, Lightbulb, ListChecks, Tag } from "lucide-react";
import type { Summary } from "@/types/summary";

interface SummaryViewProps {
  summary: Summary;
  /** Rendered in the top-right corner (e.g. Share / Regenerate buttons). */
  headerAction?: React.ReactNode;
  /** Rendered between the header row and the summary text. */
  children?: React.ReactNode;
}

export function SummaryView({
  summary,
  headerAction,
  children,
}: SummaryViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-snug tracking-tight text-ink">
            {summary.title}
          </h2>
          <span className="stamp mt-2 text-brass">
            <Tag aria-hidden="true" className="h-3 w-3" />
            {summary.documentType}
          </span>
        </div>
        {headerAction ? (
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {headerAction}
          </div>
        ) : null}
      </div>

      {children}

      <p className="whitespace-pre-wrap rounded-lg border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
        {summary.summary}
      </p>

      {summary.keyPoints.length > 0 && (
        <SummarySection
          icon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
          title="Key points"
          items={summary.keyPoints}
        />
      )}

      {summary.mainIdeas.length > 0 && (
        <SummarySection
          icon={<Lightbulb aria-hidden="true" className="h-4 w-4" />}
          title="Main ideas"
          items={summary.mainIdeas}
        />
      )}

      {summary.actionItems.length > 0 && (
        <SummarySection
          icon={<ListChecks aria-hidden="true" className="h-4 w-4" />}
          title="Action items"
          items={summary.actionItems}
        />
      )}

      {summary.entities.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wide text-ink-faint">
            <Tag aria-hidden="true" className="h-3.5 w-3.5" />
            Mentioned
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.entities.map((entity) => (
              <span
                key={entity}
                className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink-soft"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wide text-teal">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm leading-relaxed text-ink"
          >
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full border border-teal/60 bg-teal-soft"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
