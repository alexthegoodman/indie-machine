// Monthly sponsor slots. Bookings are arranged over email (see /promote) and
// added to AD_BOOKINGS by hand. A slot shows its booking while the build date
// falls in [start, end]; otherwise it shows one of our own products. Pages are
// static, so a booking appears or expires on the next deploy.

export type AdPlacement = "home" | "sidebar";

export type AdCreative = {
  name: string;
  tagline: string;
  href: string;
  cta: string;
};

export type AdBooking = AdCreative & {
  placement: AdPlacement;
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
};

export const AD_PRICES = {
  home: "$79",
  sidebar: "$49",
  review: "$49",
};

export const AD_PLACEMENTS: Record<AdPlacement, { name: string; price: string; where: string }> = {
  home: {
    name: "Home page slot",
    price: AD_PRICES.home,
    where: "Under the masthead on the home page, the first thing below the top-scored list.",
  },
  sidebar: {
    name: "Article sidebar slot",
    price: AD_PRICES.sidebar,
    where: "Beside every review and dev post on wide screens, and under the article on smaller ones.",
  },
};

export const AD_BOOKINGS: AdBooking[] = [];

// Our own products, shown when a slot isn't booked.
export const HOUSE_ADS: AdCreative[] = [
  {
    name: "Yumon Pet",
    tagline: "Free, private AI that runs on your iGPU, with an aquarium simulation. Nothing leaves your machine.",
    href: "/free-ai",
    cta: "GET FREE AI",
  },
  {
    name: "Allegiance",
    tagline: "Found a nation and contest territory in a shared world, right in the browser.",
    href: "/games",
    cta: "PLAY NOW",
  },
  {
    name: "Nebula Kingdom",
    tagline: "You start as a moon-sized wisp, eat planets, slay cosmic beings, and grow larger than any star.",
    href: "/games",
    cta: "PLAY NOW",
  },
];

export function activeAd(placement: AdPlacement, now = new Date()): AdBooking | undefined {
  const today = now.toISOString().slice(0, 10);
  return AD_BOOKINGS.find((ad) => ad.placement === placement && ad.start <= today && today <= ad.end);
}

// Picks a house ad from a seed so the choice is stable per page.
export function houseAd(seed: string): AdCreative {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HOUSE_ADS[h % HOUSE_ADS.length];
}
