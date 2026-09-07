import Tracker from '@/components/streakfreak/tracker';
import { Guide } from '@/components/streakfreak/guide';
import { structuredData } from '@/lib/site-schema';

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <Tracker>
        <Guide />
      </Tracker>
    </>
  );
}
