import { Answer, SearchResult, SourceStatus } from "./types";
import { fetchJson, stripHtml } from "./fetchUtils";

// A diverse, high-traffic slice of the network so results aren't tech-only.
const SE_SITES = [
  "stackoverflow",
  "superuser",
  "cooking",
  "travel",
  "money",
  "fitness",
  "diy",
  "gaming",
];

const SITE_LABEL: Record<string, string> = {
  stackoverflow: "Stack Overflow",
  superuser: "Super User",
  cooking: "Seasoned Advice",
  travel: "Travel SE",
  money: "Personal Finance SE",
  fitness: "Fitness SE",
  diy: "Home Improvement SE",
  gaming: "Arqade",
};

interface SeOwner {
  display_name?: string;
}
interface SeQuestion {
  question_id: number;
  title: string;
  link: string;
  score: number;
  answer_count: number;
  creation_date: number;
  body?: string;
  owner?: SeOwner;
}
interface SeAnswer {
  answer_id: number;
  question_id: number;
  score: number;
  body?: string;
  creation_date: number;
  owner?: SeOwner;
}
interface SeResponse<T> {
  items: T[];
  quota_remaining?: number;
  backoff?: number;
}

function key(): string {
  return process.env.STACKEXCHANGE_KEY
    ? `&key=${process.env.STACKEXCHANGE_KEY}`
    : "";
}

function clamp(text: string, max = 900): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function originOf(link: string): string {
  try {
    return new URL(link).origin;
  } catch {
    return "https://stackexchange.com";
  }
}

async function searchSite(
  query: string,
  site: string
): Promise<Array<SeQuestion & { site: string }>> {
  try {
    const url =
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance` +
      `&q=${encodeURIComponent(query)}&site=${site}&answers=1&pagesize=3` +
      `&filter=withbody${key()}`;
    const json = await fetchJson<SeResponse<SeQuestion>>(url, { timeoutMs: 7000 });
    return (json.items ?? []).map((q) => ({ ...q, site }));
  } catch {
    return [];
  }
}

async function fetchAnswers(
  site: string,
  questionIds: number[],
  perQuestion: number
): Promise<Map<number, Answer[]>> {
  const byQuestion = new Map<number, Answer[]>();
  if (questionIds.length === 0) return byQuestion;
  try {
    const ids = questionIds.join(";");
    const url =
      `https://api.stackexchange.com/2.3/questions/${ids}/answers?order=desc&sort=votes` +
      `&site=${site}&pagesize=${perQuestion * questionIds.length}&filter=withbody${key()}`;
    const json = await fetchJson<SeResponse<SeAnswer>>(url, { timeoutMs: 7000 });
    for (const a of json.items ?? []) {
      const body = stripHtml(a.body ?? "");
      if (body.length < 24) continue;
      const list = byQuestion.get(a.question_id) ?? [];
      if (list.length >= perQuestion) continue;
      list.push({
        id: `se_a_${a.answer_id}`,
        author: a.owner?.display_name || "user",
        body: clamp(body),
        score: a.score ?? 0,
        url: `${a.answer_id}`, // answer id; caller builds the full /a/<id> URL
        createdUtc: a.creation_date ?? 0,
      });
      byQuestion.set(a.question_id, list);
    }
  } catch {
    /* ignore */
  }
  return byQuestion;
}

export async function searchStackExchange(
  query: string,
  opts: { topQuestions?: number; answersPerQuestion?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { topQuestions = 5, answersPerQuestion = 2 } = opts;
  try {
    const perSite = await Promise.all(SE_SITES.map((s) => searchSite(query, s)));
    const candidates = perSite
      .flat()
      .filter((q) => q.answer_count > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, topQuestions);

    if (candidates.length === 0) {
      return { results: [], status: { ok: true, count: 0 } };
    }

    // Group the winning questions by site and fetch their answers in batches.
    const bySite = new Map<string, SeQuestion[]>();
    for (const q of candidates) {
      const list = bySite.get(q.site) ?? [];
      list.push(q);
      bySite.set(q.site, list);
    }

    const answerMaps = await Promise.all(
      [...bySite.entries()].map(async ([site, qs]) => {
        const map = await fetchAnswers(
          site,
          qs.map((q) => q.question_id),
          answersPerQuestion
        );
        return { site, map };
      })
    );
    const answersBySite = new Map(answerMaps.map((a) => [a.site, a.map]));

    const results: SearchResult[] = candidates
      .map((q) => {
        const origin = originOf(q.link);
        const answers = (answersBySite.get(q.site)?.get(q.question_id) ?? []).map(
          (a) => ({ ...a, url: `${origin}/a/${a.url}` })
        );
        const result: SearchResult = {
          id: `se_${q.site}_${q.question_id}`,
          source: "se",
          title: stripHtml(q.title),
          subtitle: SITE_LABEL[q.site] ?? q.site,
          url: q.link,
          score: q.score ?? 0,
          numComments: q.answer_count ?? 0,
          createdUtc: q.creation_date ?? 0,
          selfText: q.body ? clamp(stripHtml(q.body), 360) : undefined,
          answers,
        };
        return result;
      })
      .filter((r) => r.answers.length > 0);

    return { results, status: { ok: true, count: results.length } };
  } catch {
    return {
      results: [],
      status: { ok: false, count: 0, note: "Stack Exchange could not be reached." },
    };
  }
}
