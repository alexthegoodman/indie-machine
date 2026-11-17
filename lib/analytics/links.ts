// URL building for /insights. Every view is a URL, so drilling in is just a link.
import { all, type Dim, type Step } from "./query";

export type Params = Record<string, string | string[] | undefined>;

/** Params that describe the slice of data (kept when moving between views). */
const SLICE = ["range", "from", "to", "tz", "f", "did", "didnt"];

export class Links {
  constructor(private params: Params) {}

  private base(keepAll: boolean): URLSearchParams {
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(this.params)) {
      if (!keepAll && !SLICE.includes(k)) continue;
      for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) out.append(k, x);
    }
    return out;
  }

  private href(p: URLSearchParams): string {
    const s = p.toString();
    return s ? `/insights?${s}` : "/insights";
  }

  /** Same slice, another view (and its own params). */
  view(view: string, extra: Record<string, string | string[]> = {}): string {
    const p = this.base(false);
    if (view !== "overview") p.set("view", view);
    for (const [k, v] of Object.entries(extra)) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
    return this.href(p);
  }

  /** This exact view with some params replaced (undefined removes). */
  with(changes: Record<string, string | string[] | undefined>): string {
    const p = this.base(true);
    for (const [k, v] of Object.entries(changes)) {
      p.delete(k);
      if (v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
    }
    return this.href(p);
  }

  /** This view, narrowed to dim = value (or != value). Replaces an existing filter on the dim. */
  filter(dim: Dim, value: string | null, neg = false): string {
    const v = value ?? "(none)";
    const kept = all(this.params, "f").filter((f) => !f.replace(/^!/, "").startsWith(`${dim}:`));
    return this.with({ f: [...kept, `${neg ? "!" : ""}${dim}:${v}`], page: undefined, before: undefined });
  }

  removeFilter(raw: string): string {
    return this.with({ f: all(this.params, "f").filter((f) => f !== raw), page: undefined, before: undefined });
  }

  toggleFilter(raw: string): string {
    const flipped = raw.startsWith("!") ? raw.slice(1) : `!${raw}`;
    return this.with({ f: all(this.params, "f").map((f) => (f === raw ? flipped : f)) });
  }

  /** Keep only sessions that did (or didn't) this step. */
  segment(step: string, negate = false): string {
    const key = negate ? "didnt" : "did";
    const kept = all(this.params, key).filter((s) => s !== step);
    return this.with({ [key]: [...kept, step], page: undefined, before: undefined });
  }

  removeSegment(key: "did" | "didnt", step: Step): string {
    return this.with({ [key]: all(this.params, key).filter((s) => s !== step.raw) });
  }

  /** Hidden inputs that carry the current params through a GET form, minus the ones it sets. */
  hidden(except: string[]): [string, string][] {
    const out: [string, string][] = [];
    for (const [k, v] of this.base(true)) if (!except.includes(k)) out.push([k, v]);
    return out;
  }
}
