import type { Metadata } from "next";
import Link from "next/link";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { COURSES, KIND_LABEL, courseMinutes, quizCount } from "@/lib/courses";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

const TITLE = "Free Interactive Machine Learning Courses | Indie Machine";
const DESCRIPTION =
  "Free, interactive courses on niche machine learning ideas, step by step, with live visualizations, quizzes and code in PyTorch and Hyperfield (TypeScript).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/courses" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/courses", siteName: SITE_NAME, type: "website", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function CoursesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: COURSES.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/courses/${c.slug}`),
      name: c.title,
    })),
  };

  return (
    <PageBody>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ChannelHeader
        kicker="// LEARN BY POKING AT IT /courses"
        title="Courses"
        blurb="Short, free, interactive courses on one niche idea at a time. Slide by slide, question by question, with diagrams you can drag and code that runs in the page."
        stats={[`${COURSES.length} ${COURSES.length === 1 ? "COURSE" : "COURSES"}`, "FREE", "NO SIGN-UP"]}
      />
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-5 pb-10">
        {COURSES.map((c) => (
          <article key={c.slug} className="group relative flex flex-col gap-4 border border-line/22 p-5 hover:border-accent/60" data-course-card={c.slug}>
            <div className="flex flex-wrap gap-1.5">
              {c.lessons.map((l, i) => (
                <span key={l.slug} title={l.title} className="flex h-8 w-8 items-center justify-center border border-accent/40 font-display text-xs text-accent">
                  {i + 1}
                </span>
              ))}
            </div>
            <Link
              href={`/courses/${c.slug}`}
              className="font-display text-2xl leading-tight font-bold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
            >
              {c.title}
            </Link>
            <p className="font-display text-[15px] leading-relaxed text-ink-300">{c.tagline}</p>
            <p className="text-xs leading-relaxed text-ink-400">{c.description}</p>
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-[11px] tracking-[0.1em] text-ink-500">
              <span>{c.lessons.length} LESSONS</span>
              <span>~{courseMinutes(c)} MIN</span>
              <span>{c.lessons.reduce((n, l) => n + quizCount(l), 0)} QUESTIONS</span>
              <span>{[...new Set(c.lessons.map((l) => KIND_LABEL[l.kind]))].join(" · ")}</span>
            </div>
          </article>
        ))}
      </div>
    </PageBody>
  );
}
