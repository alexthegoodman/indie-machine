// Mean of a post's scorecard, rounded to one decimal, or undefined if it
// has none. Kept free of fs so client code can share it.
export function averageScore(post: { scores?: Record<string, number> }): number | undefined {
  const values = Object.values(post.scores ?? {});
  if (!values.length) return undefined;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
