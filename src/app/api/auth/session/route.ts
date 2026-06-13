import { NextRequest, NextResponse } from "next/server";
import { parseSession, redditConfigured, SESSION_COOKIE } from "@/lib/redditAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json(
    {
      available: redditConfigured(),
      connected: !!session,
      username: session?.username ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
