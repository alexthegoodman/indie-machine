import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { SheetChrome } from "@/components/SheetChrome";
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
  title: "Indie Machine — Rust, native, complex applications",
  description:
    "Indie Machine is a build log for Entropy, a native engine written from scratch in Rust — GPU compute pipelines, an in-house GUI kit, and everything measured against a real commit.",
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
