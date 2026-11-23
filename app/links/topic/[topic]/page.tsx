import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { LinkFeed, TopicNav } from "@/components/links/LinkList";
import { LINK_TOPICS, getAllLinks, toLinkSummary, type LinkTopic } from "@/lib/links";
import { SITE_NAME } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LINK_TOPICS).map((topic) => ({ topic }));
}

function topicOf(raw: string): LinkTopic | undefined {
  return raw in LINK_TOPICS ? (raw as LinkTopic) : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const topic = topicOf((await params).topic);
  if (!topic) return {};
  const { label, blurb } = LINK_TOPICS[topic];
  const url = `/links/topic/${topic}`;
  const title = `Trending ${label} Links`;
  return {
    title: `${title} | Indie Machine`,
    description: blurb,
    alternates: { canonical: url },
    openGraph: { title, description: blurb, url, siteName: SITE_NAME, type: "website", images: ["/opengraph-image"] },
  };
}

export default async function LinkTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const topic = topicOf((await params).topic);
  if (!topic) notFound();
  const { label, blurb } = LINK_TOPICS[topic];
  const links = getAllLinks().filter((l) => l.topic === topic);

  return (
    <PageBody>
      <ChannelHeader
        kicker={`// CHANNEL /links/topic/${topic}`}
        title={`Trending ${label}`}
        blurb={blurb}
        stats={[`${links.length} LINKS`]}
      >
        <div className="mt-2">
          <TopicNav active={topic} />
        </div>
      </ChannelHeader>
      <div className="mt-8 max-w-4xl pb-16">
        <LinkFeed links={links.map(toLinkSummary)} />
      </div>
    </PageBody>
  );
}
