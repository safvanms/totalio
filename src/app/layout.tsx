import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * Absolute site URL, so link previews (WhatsApp, Slack, iMessage…) get a full
 * image URL. Set NEXT_PUBLIC_SITE_URL to your domain; on Vercel the production
 * domain is used automatically when it isn't set.
 */
function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const raw = explicit || (vercel ? `https://${vercel}` : `http://localhost:${process.env.PORT ?? 3000}`);
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL("http://localhost:3000");
  }
}

const description = "Track every expense and see where your money goes: dashboards, calculated categories with formulas, and reports.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Totalio · Personal expense tracker", template: "%s · Totalio" },
  description,
  applicationName: "Totalio",
  openGraph: {
    type: "website",
    siteName: "Totalio",
    title: "Totalio · Personal expense tracker",
    description,
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Totalio · Personal expense tracker",
    description,
  },
  appleWebApp: { title: "Totalio", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
