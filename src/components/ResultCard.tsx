import styles from "@/app/page.module.css";
import { SearchResult } from "@/lib/types";
import { compact, timeAgo } from "@/lib/format";
import {
  ArrowUpIcon,
  CommentIcon,
  HeartIcon,
  ExternalIcon,
} from "./icons";

export default function ResultCard({
  result,
  index,
}: {
  result: SearchResult;
  index: number;
}) {
  const isSocial = result.source === "x" || result.source === "bluesky";
  const showUpvote =
    result.source === "reddit" ||
    result.source === "hn" ||
    result.source === "se" ||
    result.source === "lemmy";
  const authorPrefix = result.source === "reddit" ? "u/" : "";
  const badgeMeta: Record<string, { label: string; cls: string }> = {
    reddit: { label: "Reddit", cls: styles.badgeReddit },
    hn: { label: "Hacker News", cls: styles.badgeHn },
    x: { label: "X", cls: styles.badgeX },
    bluesky: { label: "Bluesky", cls: styles.badgeBsky },
    se: { label: "Stack Exchange", cls: styles.badgeSe },
    lemmy: { label: "Lemmy", cls: styles.badgeLemmy },
  };
  const badge = badgeMeta[result.source] ?? badgeMeta.reddit;

  if (result.preview) {
    const openLabel = result.source === "reddit" ? "Open on Reddit" : "Open on X";
    let displayUrl = result.url;
    try {
      const u = new URL(result.url);
      displayUrl = u.hostname.replace(/^www\./, "") + u.pathname;
      if (displayUrl.length > 72) displayUrl = displayUrl.slice(0, 69) + "…";
    } catch {
      /* keep full url */
    }

    return (
      <article
        className={`${styles.card} ${styles.previewCard}`}
        style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
      >
        <div className={styles.cardHead}>
          <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
          <div className={styles.cardTitleWrap}>
            <a
              className={styles.cardTitle}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.title}
            </a>
            {result.subtitle && (
              <div className={styles.cardSub}>
                <span className={styles.src}>{result.subtitle}</span>
              </div>
            )}
          </div>
        </div>
        {result.snippet && (
          <p className={styles.previewSnippet}>{result.snippet}</p>
        )}
        <a
          className={styles.previewLink}
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.previewUrl}>{displayUrl}</span>
          <span className={styles.previewOpen}>
            {openLabel} <ExternalIcon />
          </span>
        </a>
      </article>
    );
  }

  return (
    <article
      className={styles.card}
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
    >
      <div className={styles.cardHead}>
        <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
        <div className={styles.cardTitleWrap}>
          <a
            className={styles.cardTitle}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {isSocial ? result.subtitle ?? "View post" : result.title}
          </a>
          <div className={styles.cardSub}>
            {!isSocial && result.subtitle && (
              <span className={styles.src}>{result.subtitle}</span>
            )}
            <span className={styles.statIcon}>
              {showUpvote ? (
                <ArrowUpIcon className={styles.up} />
              ) : (
                <HeartIcon />
              )}
              {compact(result.score)}
            </span>
            {result.numComments !== undefined && (
              <span className={styles.statIcon}>
                <CommentIcon />
                {compact(result.numComments)}
              </span>
            )}
            {result.createdUtc > 0 && <span>{timeAgo(result.createdUtc)}</span>}
          </div>
        </div>
      </div>

      {result.selfText && <p className={styles.selfText}>{result.selfText}</p>}

      {/* For social posts (X, Bluesky), the post text is the human response. */}
      {isSocial && <p className={styles.tweetBody}>{result.title}</p>}

      {result.answers.length > 0 && (
        <div className={styles.answers}>
          {result.answers.map((a) => (
            <div className={styles.answer} key={a.id}>
              <div className={styles.answerHead}>
                <span className={styles.answerAuthor}>
                  {authorPrefix}
                  {a.author}
                </span>
                {a.score > 0 && (
                  <span className={styles.answerScore}>
                    <ArrowUpIcon className={styles.up} size={12} />
                    {compact(a.score)}
                  </span>
                )}
                {a.createdUtc > 0 && (
                  <span className={styles.answerTime}>
                    {timeAgo(a.createdUtc)}
                  </span>
                )}
              </div>
              <div className={styles.answerBody}>{a.body}</div>
              <a
                className={styles.answerLink}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                view reply <ExternalIcon />
              </a>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
