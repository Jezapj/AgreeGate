"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "@/app/page.module.css";

interface SessionInfo {
  available: boolean;
  connected: boolean;
  username: string | null;
}

export default function ConnectReddit() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      setInfo(await res.json());
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/auth/reddit/logout", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  // Hide entirely if the server has no Reddit app configured.
  if (!info || !info.available) return null;

  if (info.connected) {
    return (
      <div className={styles.connect} title="Searching on your own Reddit rate limit">
        <span className={styles.connectDot} />
        <span className={styles.connectUser}>u/{info.username ?? "you"}</span>
        <button
          className={styles.connectBtn}
          onClick={disconnect}
          disabled={busy}
          type="button"
        >
          {busy ? "…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <a
      className={styles.connectLink}
      href="/api/auth/reddit/login"
      title="Connect your Reddit account for higher rate limits"
    >
      <RedditGlyph />
      Connect Reddit
    </a>
  );
}

function RedditGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5.6 9.3c.03.2.05.4.05.6 0 2.5-2.9 4.5-6.5 4.5s-6.5-2-6.5-4.5c0-.2.02-.4.05-.6a1.4 1.4 0 1 1 1.7-2.2 7.9 7.9 0 0 1 4-1.2l.8-3.6 2.5.6a1 1 0 1 1-.1.6l-2-.5-.6 2.9c1.5.05 2.9.5 3.9 1.2a1.4 1.4 0 1 1 1.7 2.2zM8.8 12.4a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm4.4 2.7c-.6.6-2.2.6-2.8 0a.3.3 0 0 0-.5.4c.9.9 2.9.9 3.8 0a.3.3 0 1 0-.5-.4zm.9-1.7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  );
}
