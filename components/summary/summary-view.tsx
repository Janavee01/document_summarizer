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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{summary.title}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            <Tag aria-hidden="true" className="h-3 w-3" />
            {summary.documentType}
          </span>
        </div>
        {headerAction ? (
          <div className="flex shrink-0 items-center gap-2">{headerAction}</div>
        ) : null}
      </div>

      {children}

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
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
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <Tag aria-hidden="true" className="h-3.5 w-3.5" />
            Mentioned
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.entities.map((entity) => (
              <span
                key={entity}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
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
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm leading-relaxed text-zinc-800"
          >
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
