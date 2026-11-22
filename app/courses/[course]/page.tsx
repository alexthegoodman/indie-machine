import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelHeader, PageBody, ShelfHeader } from "@/components/media/ChannelHeader";
import { CourseProgressBar, LessonDoneMark } from "@/components/courses/LessonProgress";
import { COURSES, KIND_LABEL, courseMinutes, getCourse, quizCount } from "@/lib/courses";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return COURSES.map((c) => ({ course: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const c = getCourse((await params).course);
  if (!c) return {};
  const url = `/courses/${c.slug}`;
  const title = `${c.title}: Free Interactive Lessons | Indie Machine`;
  return {
    title,
    description: c.description,
    alternates: { canonical: url },
    openGraph: { title, description: c.description, url, siteName: SITE_NAME, type: "website", images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title, description: c.description, images: ["/opengraph-image"] },
  };
}

function Dots({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-300">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 ${color}`} aria-hidden="true" />
          {t}
        </li>
      ))}
    </ul>
  );
}

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const c = getCourse((await params).course);
  if (!c) notFound();
  const minutes = courseMinutes(c);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        "@id": absoluteUrl(`/courses/${c.slug}#course`),
        name: c.title,
        description: c.description,
        url: absoluteUrl(`/courses/${c.slug}`),
        provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
        isAccessibleForFree: true,
        educationalLevel: c.level,
        teaches: c.teaches,
        coursePrerequisites: c.prerequisites,
        inLanguage: "en",
        dateModified: c.updated,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `PT${minutes}M` },
        hasPart: c.lessons.map((l) => ({ "@type": "LearningResource", name: l.title, url: absoluteUrl(`/courses/${c.slug}/${l.slug}`) })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Courses", item: absoluteUrl("/courses") },
          { "@type": "ListItem", position: 2, name: c.title, item: absoluteUrl(`/courses/${c.slug}`) },
        ],
      },
    ],
  };

  return (
    <PageBody className="pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ChannelHeader
        kicker="// FREE COURSE /courses"
        title={c.title}
        blurb={c.intro}
        cta={{ href: `/courses/${c.slug}/${c.lessons[0].slug}`, label: "START LESSON 1" }}
        stats={[`${c.lessons.length} LESSONS`, `~${minutes} MIN`, c.level.toUpperCase()]}
      >
        <div className="mt-3 max-w-xl">
          <CourseProgressBar course={c.slug} lessons={c.lessons.map((l) => l.slug)} />
        </div>
      </ChannelHeader>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <ShelfHeader kicker="// STEP BY STEP" title="Lessons" />
          <ol className="flex flex-col gap-3">
            {c.lessons.map((l, i) => (
              <li key={l.slug} className="group relative flex gap-4 border border-line/22 p-4 hover:border-accent/60" data-lesson-card={l.slug}>
                <span className="font-display text-3xl leading-none font-bold text-accent/60">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] tracking-[0.14em] text-ink-500">
                    <span className="border border-line/22 px-1.5 py-0.5 text-badge">{KIND_LABEL[l.kind]}</span>
                    <span>{l.minutes} MIN</span>
                    <span>{l.slides.length} SLIDES</span>
                    <span>{quizCount(l)} QUESTIONS</span>
                    <LessonDoneMark id={`${c.slug}/${l.slug}`} />
                  </div>
                  <Link
                    href={`/courses/${c.slug}/${l.slug}`}
                    className="font-display text-lg font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
                  >
                    {l.title}
                  </Link>
                  <p className="text-xs leading-relaxed text-ink-400">{l.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="flex flex-col gap-6">
          <div>
            <ShelfHeader kicker="// OUTCOMES" title="You will learn" />
            <Dots items={c.teaches} color="bg-accent" />
          </div>
          <div>
            <ShelfHeader kicker="// BEFORE YOU START" title="Helpful to know" />
            <Dots items={c.prerequisites} color="bg-badge" />
          </div>
        </aside>
      </div>
    </PageBody>
  );
}
