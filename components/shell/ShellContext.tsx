"use client";

import { createContext, useContext } from "react";
import type { MediaItem } from "@/lib/media";

export type ShellApi = {
  // Every post, newest first - the search palette, dock and library read it.
  items: MediaItem[];
  bySlug: Map<string, MediaItem>;
  toast: (message: string) => void;
  openSearch: () => void;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const api = useContext(ShellContext);
  if (!api) throw new Error("useShell must be used inside <AppShell>");
  return api;
}
