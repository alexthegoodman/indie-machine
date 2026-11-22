import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody } from "@/components/media/ChannelHeader";
import { LessonPlayer, type PlayerSlide } from "@/components/courses/LessonPlayer";
import { LessonDoneMark } from "@/components/courses/LessonProgress";
import { Quiz } from "@/components/courses/Quiz";
import { COURSES, KIND_LABEL, getLesson } from "@/lib/courses";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return COURSES.flatMap((c) => c.lessons.map((l) => ({ course: c.slug, lesson: l.slug })));
}

type Params = Promise<{ course: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { course, lesson } = await params;
  const found = getLesson(course, lesson);
  if (!found) return {};
  const { course: c, lesson: l, index } = found;
  const url = `/courses/${c.slug}/${l.slug}`;
  const title = `${l.title} - ${c.title}, Lesson ${index + 1} | Indie Machine`;
  return {
    title,
    description: l.summary,
    alternates: { canonical: url },
    openGraph: { title, description: l.summary, url, siteName: SITE_NAME, type: "article", images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title, description: l.summary, images: ["/opengraph-image"] },
  };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { course, lesson } = await params;
  const found = getLesson(course, lesson);
  if (!found) notFound();
  const { course: c, lesson: l, index } = found;
  const next = c.lessons[index + 1];
  const prev = c.lessons[index - 1];
  const url = absoluteUrl(`/courses/${c.slug}/${l.slug}`);

  const slides: PlayerSlide[] = l.slides.map((s) => ({
    id: s.id,
    title: s.title,
    quizAnswer: s.quiz?.answer,
    body: s.quiz ? <Quiz quiz={s.quiz} storeKey={`${c.slug}/${l.slug}/${s.id}`} /> : s.body,
  }));

  const finale = (
    <div className="border border-emerald-400/40 bg-emerald-400/5 p-5" data-finale>
      <div className="mb-1 text-[11px] tracking-[0.16em] text-emerald-300">LESSON {index + 1} COMPLETE</div>
      <p className="mb-4 font-display text-lg text-ink-100">{next ? `Up next: ${next.title}` : `That's the whole ${c.title}. Nice work.`}</p>
      <div className="flex flex-wrap gap-3">
        {next ? (
          <Link
            href={`/courses/${c.slug}/${next.slug}`}
            className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
          >
            LESSON {index + 2} -&gt;
          </Link>
        ) : null}
        <Link href={`/courses/${c.slug}`} className="inline-flex h-11 items-center border border-line/32 px-4 text-xs tracking-[0.1em] text-ink-100! hover:border-accent">
          ALL LESSONS
        </Link>
      </div>
    </div>
  );

  const quizzes = l.slides.filter((s) => s.quiz);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": `${url}#lesson`,
        name: l.title,
        description: l.summary,
        url,
        learningResourceType: KIND_LABEL[l.kind] === "CODE" ? "Tutorial" : "Lesson",
        educationalLevel: c.level,
        isAccessibleForFree: true,
        inLanguage: "en",
        timeRequired: `PT${l.minutes}M`,
        teaches: l.takeaways,
        position: index + 1,
        isPartOf: { "@type": "Course", "@id": absoluteUrl(`/courses/${c.slug}#course`), name: c.title, url: absoluteUrl(`/courses/${c.slug}`) },
        provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
      },
      {
        "@type": "Quiz",
        name: `${l.title} - check yourself`,
        about: l.title,
        hasPart: quizzes.map((s) => ({
          "@type": "Question",
          name: s.quiz!.question,
          eduQuestionType: "Multiple choice",
          acceptedAnswer: { "@type": "Answer", text: s.quiz!.options[s.quiz!.answer] },
          suggestedAnswer: s.quiz!.options.filter((_, i) => i !== s.quiz!.answer).map((text) => ({ "@type": "Answer", text })),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Courses", item: absoluteUrl("/courses") },
          { "@type": "ListItem", position: 2, name: c.title, item: absoluteUrl(`/courses/${c.slug}`) },
          { "@type": "ListItem", position: 3, name: l.title, item: url },
        ],
      },
    ],
  };

  return (
    <PageBody className="pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-[11px] tracking-[0.12em] text-ink-500">
        <Link href="/courses" className="text-ink-400! hover:text-accent!">
          COURSES
        </Link>
        <span>/</span>
        <Link href={`/courses/${c.slug}`} className="text-ink-400! hover:text-accent!">
          {c.title.toUpperCase()}
        </Link>
        <span>/</span>
        <span className="text-ink-300">LESSON {index + 1}</span>
      </nav>

      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[10px] tracking-[0.14em] text-ink-500">
          <span className="border border-line/22 px-1.5 py-0.5 text-badge">{KIND_LABEL[l.kind]}</span>
          <span>
            LESSON {index + 1} OF {c.lessons.length}
          </span>
          <span>{l.minutes} MIN</span>
          <LessonDoneMark id={`${c.slug}/${l.slug}`} />
        </div>
        <h1 className="font-display text-4xl leading-[1.05] font-bold text-ink-100 md:text-5xl">{l.title}</h1>
        <p className="max-w-3xl font-display text-base leading-relaxed text-ink-300">{l.summary}</p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <LessonPlayer course={c.slug} lesson={l.slug} slides={slides} finale={finale} />
        </div>
        <aside className="flex flex-col gap-6">
          <section className="border border-line/18 p-4">
            <h2 className="mb-3 text-[10px] tracking-[0.16em] text-accent">KEY TAKEAWAYS</h2>
            <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-300">
              {l.takeaways.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
          <nav aria-label="Lessons" className="border border-line/18 p-4">
            <h2 className="mb-3 text-[10px] tracking-[0.16em] text-accent">{c.title.toUpperCase()}</h2>
            <ol className="flex flex-col gap-1">
              {c.lessons.map((x, i) => (
                <li key={x.slug}>
                  <Link
                    href={`/courses/${c.slug}/${x.slug}`}
                    aria-current={x.slug === l.slug ? "page" : undefined}
                    className={`flex gap-2.5 py-1.5 text-[13px] ${x.slug === l.slug ? "text-accent!" : "text-ink-300! hover:text-ink-100!"}`}
                  >
                    <span className="w-5 shrink-0 text-ink-500">{i + 1}.</span>
                    <span className="flex-1">{x.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex justify-between gap-3 text-[11px] tracking-[0.12em]">
            {prev ? <Link href={`/courses/${c.slug}/${prev.slug}`}>&lt;- LESSON {index}</Link> : <span />}
            {next && <Link href={`/courses/${c.slug}/${next.slug}`}>LESSON {index + 2} -&gt;</Link>}
          </div>
        </aside>
      </div>
    </PageBody>
  );
}
