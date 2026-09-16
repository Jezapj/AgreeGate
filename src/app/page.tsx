"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import SearchBar from "@/components/SearchBar";
import ResultCard from "@/components/ResultCard";
import { SearchResponse, Source } from "@/lib/types";
import { groupResultsBySource } from "@/lib/relevance";

const EXAMPLES = [
  "best way to cook salmon",
  "tips for visiting japan",
  "can you microwave wooden things",
  "how to fix a leaky faucet",
  "is the carnivore diet actually healthy",
];

const SOURCE_LABELS: Record<Source, string> = {
  bluesky: "Bluesky",
  lemmy: "Lemmy",
  se: "Stack Exchange",
  hn: "Hacker News",
  reddit: "Reddit",
  x: "X",
};
const SOURCE_NOTES_ORDER: Source[] = [
  "reddit",
  "x",
  "bluesky",
  "lemmy",
  "se",
  "hn",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedSource, setFocusedSource] = useState<Source | null>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);

  const sourceGroups = useMemo(
    () => (data ? groupResultsBySource(data.results) : []),
    [data]
  );

  const groupedView = useMemo(
    () =>
      data && focusedSource
        ? groupResultsBySource(data.results, focusedSource)
        : [],
    [data, focusedSource]
  );

  const toggleSource = useCallback((source: Source) => {
    setFocusedSource((prev) => {
      const next = prev === source ? null : source;
      if (next) {
        requestAnimationFrame(() => {
          resultsTopRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      return next;
    });
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setData(null);
    setFocusedSource(null);

    const params = new URLSearchParams({ q: trimmed });
    window.history.replaceState(null, "", `/?${params.toString()}`);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: SearchResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore a query from the URL on first load (e.g. shared link).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) runSearch(q);
  }, [runSearch]);

  const hasSearched = activeQuery.length > 0;

  if (!hasSearched) {
    return (
      <main className={styles.page}>
        <div className={styles.home}>
          <div className={styles.hero}>
            <Image
              className={styles.logoMark}
              src="/GateTRNSP.png"
              alt="AgreeGate"
              width={104}
              height={104}
              priority
            />
            <h1 className={styles.wordmark}>
              <span className={styles.agree}>Agree</span>
              <span className={styles.gate}>Gate</span>
            </h1>
            <p className={styles.tagline}>
            <br></br>
              Any Question, Dumb or Smart<br></br> Get the <b>Agreed</b> Upon answer 
              from <b>real people</b>
              <br></br><br></br>No sponsored results. No AI summaries.
            </p>

            <SearchBar onSearch={runSearch} loading={loading} autoFocus />

            <div className={styles.chips}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className={styles.chip}
                  onClick={() => runSearch(ex)}
                  type="button"
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className={styles.promises}>
              <span className={styles.promise}>
                <span className={styles.dot} /> Only human responses
              </span>
              <span className={styles.promise}>
                <span className={styles.dot} /> Zero ads or sponsors
              </span>
              <span className={styles.promise}>
                <span className={styles.dot} /> No generated answers
              </span>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className={styles.resultsPage}>
      <header className={styles.topbar}>
        <a
          className={styles.topbarBrand}
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveQuery("");
            setData(null);
            setQuery("");
            setFocusedSource(null);
            window.history.replaceState(null, "", "/");
          }}
        >
          <Image
            className={styles.topbarLogo}
            src="/GateTRNSP.png"
            alt="AgreeGate"
            width={34}
            height={34}
          />
          <span className={styles.topbarName}>
            Agree<span className={styles.gate}>Gate</span>
          </span>
        </a>
        <div className={styles.topbarSearch}>
          <SearchBar
            onSearch={runSearch}
            loading={loading}
            initialValue={query}
          />
        </div>
      </header>

      <div className={styles.results}>
        {loading && <LoadingState />}

        {!loading && error && (
          <div className={styles.errorNote}>{error}</div>
        )}

        {!loading && data && (
          <>
            <div className={styles.metaRow}>
              <div className={styles.metaPillsScroll}>
                {[
                  ...sourceGroups.map(({ source, results }) => ({
                    source,
                    count: results.length,
                    ok: data.sources[source]?.ok ?? false,
                  })),
                  ...SOURCE_NOTES_ORDER.filter(
                    (source) =>
                      data.sources[source] &&
                      !sourceGroups.some((g) => g.source === source)
                  ).map((source) => ({
                    source,
                    count: data.sources[source]?.count ?? 0,
                    ok: data.sources[source]?.ok ?? false,
                  })),
                ].map(({ source, count, ok }) => (
                  <SourcePill
                    key={source}
                    label={SOURCE_LABELS[source]}
                    ok={ok}
                    count={count}
                    active={focusedSource === source}
                    onClick={() => toggleSource(source)}
                  />
                ))}
              </div>
              <span className={styles.metaStats}>
                {data.results.length} result
                {data.results.length === 1 ? "" : "s"} · {data.tookMs}ms
              </span>
            </div>

            <div ref={resultsTopRef} className={styles.resultsList}>
              {data.results.length === 0 ? (
                <div className={styles.empty}>
                  <h3>No human answers found</h3>
                  <p>
                    Try rephrasing - broader, conversational wording tends to match
                    real discussions best.
                  </p>
                </div>
              ) : focusedSource ? (
                groupedView.map(({ source, results }) => (
                  <section key={source} className={styles.sourceSection}>
                    <h2 className={styles.sourceHeading}>
                      {SOURCE_LABELS[source]}
                      <span className={styles.sourceHeadingCount}>
                        {results.length}
                      </span>
                    </h2>
                    {results.map((r, i) => (
                      <ResultCard key={r.id} result={r} index={i} />
                    ))}
                  </section>
                ))
              ) : (
                data.results.map((r, i) => (
                  <ResultCard key={r.id} result={r} index={i} />
                ))
              )}
            </div>

            {(sourceNotes(data).length > 0) && (
              <div className={styles.sourceNotes}>
                {sourceNotes(data).map((note, i) => (
                  <p key={i}>{note}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}

function sourceNotes(data: SearchResponse): string[] {
  const notes: string[] = [];
  for (const key of SOURCE_NOTES_ORDER) {
    const s = data.sources[key];
    if (s && !s.ok && s.note) notes.push(s.note);
  }
  return notes;
}

function SourcePill({
  label,
  ok,
  count,
  active,
  onClick,
}: {
  label: string;
  ok: boolean;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const clickable = ok && count > 0;

  return (
    <button
      type="button"
      className={`${styles.sourcePill} ${clickable ? styles.sourcePillBtn : ""} ${
        active ? styles.sourcePillActive : ""
      }`}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      aria-pressed={active}
      aria-label={
        clickable
          ? active
            ? `Show all sources, ${label} grouped view on`
            : `Group by source with ${label} first, ${count} results`
          : `${label} unavailable`
      }
    >
      <span className={`${styles.led} ${ok ? styles.ledOn : styles.ledOff}`} />
      {label}
      {ok ? ` · ${count}` : " · off"}
    </button>
  );
}

function LoadingState() {
  return (
    <div>
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <span>Searching Reddit, X, Bluesky, Stack Exchange &amp; more…</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div className={styles.skeleton} key={i} />
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <b>AgreeGate</b> - real answers from real humans. Reddit &amp; X link out to
      the original posts; other sources show inline human responses.
    </footer>
  );
}
