import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { SheetChrome } from "@/components/SheetChrome";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Indie Machine — Rust, native, complex applications",
  description: SITE_DESCRIPTION,
  alternates: {
    types: { "application/rss+xml": "/rss.xml" },
  },
  openGraph: {
    title: "Indie Machine — Rust, native, complex applications",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indie Machine — Rust, native, complex applications",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-ink font-mono text-ink-300">
        <SheetChrome />
        {children}
      </body>
    </html>
  );
}
