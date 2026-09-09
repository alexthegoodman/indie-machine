export type ResolvedRepoLink = { label: string; href: string };

// Repos with a verified public GitHub remote (checked via `gh api repos/...`).
// Yumon has no public URL yet (see root CLAUDE.md) - a post referencing it
// stays plain text in the TitleBlock rather than guessing a GitHub URL.
const KNOWN_REPOS: Record<string, string> = {
  "entropy-engine": "https://github.com/alexthegoodman/entropy-engine",
  "indie-machine": "https://github.com/alexthegoodman/indie-machine",
};

// Frontmatter `repo_link` is either a full URL (an external product's own
// repo, e.g. a Product Hunt pick) or "<repo-name> @ <commit>" for this
// site's own series posts. Only resolve it into a clickable button when we
// actually know where it points.
export function resolveRepoLink(repoLink: string | undefined): ResolvedRepoLink | undefined {
  if (!repoLink) return undefined;

  if (/^https?:\/\//.test(repoLink)) {
    try {
      const url = new URL(repoLink);
      const path = url.pathname.replace(/^\/|\/$/g, "");
      return { label: path || url.hostname, href: repoLink };
    } catch {
      return undefined;
    }
  }

  const match = /^([\w.-]+)\s*@\s*([0-9a-f]{7,40})/i.exec(repoLink);
  if (!match) return undefined;

  const [, repoName, commit] = match;
  const base = KNOWN_REPOS[repoName];
  if (!base) return undefined;

  return { label: `${repoName} @ ${commit}`, href: `${base}/tree/${commit}` };
}
