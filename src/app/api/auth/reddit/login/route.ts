import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  buildAuthorizeUrl,
  redditConfigured,
  STATE_COOKIE,
} from "@/lib/redditAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!redditConfigured()) {
    return NextResponse.json(
      { error: "Reddit login is not configured on this server." },
      { status: 503 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(req.nextUrl.origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
