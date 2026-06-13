import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCode,
  serializeSession,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/redditAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");
  const savedState = req.cookies.get(STATE_COOKIE)?.value;

  const home = new URL("/", req.nextUrl.origin);

  function fail() {
    home.searchParams.set("connect", "error");
    const res = NextResponse.redirect(home);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (oauthError || !code || !state || !savedState || state !== savedState) {
    return fail();
  }

  const session = await exchangeCode(code, req.nextUrl.origin);
  if (!session) return fail();

  home.searchParams.set("connect", "success");
  const res = NextResponse.redirect(home);
  res.cookies.delete(STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, serializeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
