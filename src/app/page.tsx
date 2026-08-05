"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import SearchBar from "@/components/SearchBar";
import ResultCard from "@/components/ResultCard";
import ConnectReddit from "@/components/ConnectReddit";
import { SearchResponse } from "@/lib/types";

const EXAMPLES = [
  "best way to cook salmon",
  "tips for visiting japan",
  "how to fix a leaky faucet",
  "is the carnivore diet actually healthy",
];

const SOURCE_LABELS: Record<string, string> = {
  bluesky: "Bluesky",
  lemmy: "Lemmy",
  se: "Stack Exchange",
  hn: "Hacker News",
  reddit: "Reddit",
  x: "X",
};
const SOURCE_ORDER = ["bluesky", "lemmy", "se", "hn", "reddit", "x"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setData(null);

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

  // Restore a query from the URL on first load (e.g. shared link),
  // and surface the result of a Reddit connect redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (connect) {
      setNotice(
        connect === "success"
          ? "Reddit connected — you're now searching on your own rate limit."
          : "Couldn't connect Reddit. Please try again."
      );
      params.delete("connect");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `/?${rest}` : "/");
      setTimeout(() => setNotice(null), 6000);
    }
    const q = params.get("q");
    if (q) runSearch(q);
  }, [runSearch]);

  const hasSearched = activeQuery.length > 0;

  const toastEl = notice ? (
    <div className={styles.toast} role="status">
      {notice}
    </div>
  ) : null;

  if (!hasSearched) {
    return (
      <main className={styles.page}>
        {toastEl}
        <div className={styles.home}>
          <div className={styles.homeTopRight}>
            <ConnectReddit />
          </div>
          <div className={styles.hero}>
            <Image
              className={styles.logoMark}
              src="/logo-dark.png"
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
              Answers from <b>real people</b> across every topic — pulled from
              Bluesky, Lemmy, Stack Exchange &amp; Hacker News. No sponsored
              results. No AI summaries. No bots.
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
      {toastEl}
      <header className={styles.topbar}>
        <a
          className={styles.topbarBrand}
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveQuery("");
            setData(null);
            setQuery("");
            window.history.replaceState(null, "", "/");
          }}
        >
          <Image
            className={styles.topbarLogo}
            src="/logo-dark.png"
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
        <ConnectReddit />
      </header>

      <div className={styles.results}>
        {loading && <LoadingState />}

        {!loading && error && (
          <div className={styles.errorNote}>{error}</div>
        )}

        {!loading && data && (
          <>
            <div className={styles.metaRow}>
              {SOURCE_ORDER.filter((key) => data.sources[key as keyof typeof data.sources]).map(
                (key) => {
                  const s = data.sources[key as keyof typeof data.sources]!;
                  return (
                    <SourcePill
                      key={key}
                      label={SOURCE_LABELS[key] ?? key}
                      ok={s.ok}
                      count={s.count}
                    />
                  );
                }
              )}
              <span>
                {data.results.length} result
                {data.results.length === 1 ? "" : "s"} · {data.tookMs}ms
              </span>
            </div>

            {data.results.length === 0 ? (
              <div className={styles.empty}>
                <h3>No human answers found</h3>
                <p>
                  Try rephrasing — broader, conversational wording tends to match
                  real discussions best.
                </p>
              </div>
            ) : (
              data.results.map((r, i) => (
                <ResultCard key={r.id} result={r} index={i} />
              ))
            )}

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
  for (const key of SOURCE_ORDER) {
    const s = data.sources[key as keyof typeof data.sources];
    if (s && !s.ok && s.note) notes.push(s.note);
  }
  return notes;
}

function SourcePill({
  label,
  ok,
  count,
}: {
  label: string;
  ok: boolean;
  count: number;
}) {
  return (
    <span className={styles.sourcePill}>
      <span className={`${styles.led} ${ok ? styles.ledOn : styles.ledOff}`} />
      {label}
      {ok ? ` · ${count}` : " · off"}
    </span>
  );
}

function LoadingState() {
  return (
    <div>
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <span>Asking real people across Bluesky, Stack Exchange &amp; more…</span>
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
      <b>AgreeGate</b> — real answers from real humans. Every result links back
      to the original post on Bluesky, Lemmy, Stack Exchange, Hacker News &amp; more.
    </footer>
  );
}
