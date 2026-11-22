// Two bands of the post's topics under the intro, sliding in opposite
// directions as the page scrolls (--p from ScrollFx). Decorative only.
export function Marquee({ words }: { words: string[] }) {
  if (words.length < 2) return null;
  const row = [...words, ...words, ...words, ...words];
  return (
    <div data-scroll-p aria-hidden="true" className="exp-marquee my-10 select-none">
      {[0, 1].map((r) => (
        <div key={r} className={`exp-marquee-row ${r ? "exp-marquee-row--back" : ""}`}>
          {row.map((w, i) => (
            <span key={i} className={(i + r) % 3 === 1 ? "exp-marquee-alt" : undefined}>
              {w}
              <span className="exp-marquee-star">✦</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
