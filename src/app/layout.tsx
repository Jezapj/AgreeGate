import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "AgreeGate — Answers from real people",
  description:
    "A search engine that returns answers from real humans. No sponsored results. No AI summaries. Pulled live from Reddit and X.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "AgreeGate — Answers from real people",
    description:
      "Search real human answers from Reddit and X. No sponsored results. No AI summaries.",
    images: ["/logo-dark.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050605",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
