export function seriesDescription(name: string): string {
  switch (name) {
    case "Entropy":
      return "Build notes on Entropy, a Rust engine for native apps: wgpu rendering, immediate-mode UI, audio tools, and tested integrations.";
    case "Yumon":
      return "Experiments in local models and interactive worlds for Yumon Pet, with training results and implementation notes.";
    case "Product Hunt":
      return "Technical reviews of new developer tools, grounded in source code, documentation, and hands-on tests where available.";
    case "Game Announcements":
      return "Curated announcements, mechanics breakdowns, and impression badges for new and upcoming indie games.";
    case "AI News":
      return "Deep-dive analysis of frontier AI research, reasoning breakthroughs, and on-device small language model architectures.";
    default:
      return `Engineering posts in the ${name} series on Indie Machine.`;
  }
}
