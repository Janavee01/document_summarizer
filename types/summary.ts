export type SummaryLength = "short" | "medium" | "long";

export interface Summary {
  title: string;
  documentType: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
  entities: string[];
  actionItems: string[];
  improvementSuggestions: string[];
}
