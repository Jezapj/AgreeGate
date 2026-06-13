import { encrypt, decrypt } from "./crypto";
import { USER_AGENT } from "./fetchUtils";

export const SESSION_COOKIE = "ag_reddit";
export const STATE_COOKIE = "ag_rstate";

// "identity" lets us show the connected username; "read" lets us search/read.
const SCOPE = "identity read";

export interface RedditSession {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  username?: string;
}

export function redditConfigured(): boolean {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

export function getRedirectUri(origin: string): string {
  return (
    process.env.REDDIT_REDIRECT_URI || `${origin}/api/auth/reddit/callback`
  );
}

export function buildAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID || "",
    response_type: "code",
    state,
    redirect_uri: getRedirectUri(origin),
    duration: "permanent",
    scope: SCOPE,
  });
  return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
}

function basicAuth(): string {
  return Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");
}

async function tokenRequest(
  body: URLSearchParams
): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: body.toString(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchUsername(token: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { name?: string };
    return j.name;
  } catch {
    return undefined;
  }
}

export async function exchangeCode(
  code: string,
  origin: string
): Promise<RedditSession | null> {
  const j = await tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(origin),
    })
  );
  if (!j?.access_token) return null;
  const session: RedditSession = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  session.username = await fetchUsername(session.accessToken);
  return session;
}

export async function refreshSession(
  session: RedditSession
): Promise<RedditSession | null> {
  if (!session.refreshToken) return null;
  const j = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    })
  );
  if (!j?.access_token) return null;
  return {
    ...session,
    accessToken: j.access_token,
    refreshToken: j.refresh_token || session.refreshToken,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
}

export function serializeSession(session: RedditSession): string {
  return encrypt(JSON.stringify(session));
}

export function parseSession(raw: string | undefined): RedditSession | null {
  if (!raw) return null;
  const dec = decrypt(raw);
  if (!dec) return null;
  try {
    return JSON.parse(dec) as RedditSession;
  } catch {
    return null;
  }
}
