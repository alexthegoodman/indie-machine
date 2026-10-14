// Display labels for the fixed vocabularies used in product frontmatter.
// Unknown keys fall back to a title-cased version of the key, so a new
// category or platform works before it's added here.

export const CATEGORIES: Record<string, { label: string; blurb: string }> = {
  "coding-agents": {
    label: "Coding Agents",
    blurb: "Orchestrators, workspaces and terminals for running coding agents.",
  },
  "agent-infrastructure": {
    label: "Agent Infrastructure",
    blurb: "Routing, tool calling, memory and search that agents build on.",
  },
  security: {
    label: "Security & Guardrails",
    blurb: "Scanners, policy layers and audits for AI-driven systems.",
  },
  observability: {
    label: "Observability",
    blurb: "Tracing and analytics for agents and the stacks they run in.",
  },
  data: { label: "Data & Databases", blurb: "Database studios and data workspaces." },
  "developer-utilities": { label: "Developer Utilities", blurb: "Smaller tools for everyday developer work." },
  creative: { label: "Creative Tools", blurb: "Image, audio and design software." },
  "personal-agents": { label: "Personal Agents", blurb: "General-purpose agents that act on your behalf." },
  business: { label: "Business Apps", blurb: "CRMs and other line-of-business software." },
};

export const PLATFORMS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  web: "Web",
  android: "Android",
  ios: "iOS",
  cli: "CLI",
  library: "Library",
  "self-hosted": "Self-hosted",
  cloud: "Cloud",
};

export const PRICING: Record<string, string> = {
  free: "Free",
  freemium: "Free tier",
  paid: "Paid",
};

function titleCase(key: string): string {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryLabel(key: string): string {
  return CATEGORIES[key]?.label ?? titleCase(key);
}

export function platformLabel(key: string): string {
  return PLATFORMS[key] ?? titleCase(key);
}

export function scoreLabel(key: string): string {
  return titleCase(key);
}
