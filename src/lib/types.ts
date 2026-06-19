export type Source = "reddit" | "hn" | "x" | "bluesky" | "se";

export interface Answer {
  id: string;
  author: string;
  body: string;
  score: number;
  url: string;
  createdUtc: number;
}

export interface SearchResult {
  id: string;
  source: Source;
  title: string;
  subtitle?: string;
  url: string;
  score: number;
  numComments?: number;
  createdUtc: number;
  selfText?: string;
  answers: Answer[];
}

export interface SourceStatus {
  ok: boolean;
  count: number;
  note?: string;
}

export interface SearchResponse {
  query: string;
  tookMs: number;
  cached?: boolean;
  results: SearchResult[];
  sources: Partial<Record<Source, SourceStatus>>;
}
