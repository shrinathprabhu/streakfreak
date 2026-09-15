import site from './site-content.json';

const person = { '@id': 'https://shrinath.me/#person' };
const organization = { '@id': 'https://owleye.dev/#organization' };
const website = { '@id': `${site.canonical}#website` };
const app = { '@id': `${site.canonical}#app` };
const page = { '@id': `${site.canonical}#webpage` };

// Public product facts only. Personal habit data never enters this graph.
export const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      ...person,
      name: 'Shrinath Prabhu',
      url: 'https://shrinath.me',
      sameAs: ['https://x.com/shrinath_prabhu'],
    },
    {
      '@type': 'Organization',
      ...organization,
      name: 'OwlEye Analytics',
      url: 'https://owleye.dev',
      founder: person,
    },
    {
      '@type': 'WebSite',
      ...website,
      name: site.name,
      url: site.canonical,
      inLanguage: 'en',
      creator: person,
      publisher: organization,
      isPartOf: {
        '@type': 'WebSite',
        '@id': 'https://lowkey.tools/#website',
        name: 'Lowkey Tools',
        url: 'https://lowkey.tools',
      },
    },
    {
      '@type': 'WebApplication',
      ...app,
      name: site.name,
      url: site.canonical,
      description: site.summary,
      applicationCategory: 'LifestyleApplication',
      applicationSubCategory: 'Habit tracker',
      operatingSystem: 'Any',
      browserRequirements:
        'JavaScript and IndexedDB. HTTPS for offline installation.',
      isAccessibleForFree: true,
      inLanguage: 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: site.features,
      creator: person,
      author: person,
      publisher: organization,
      isPartOf: website,
      mainEntityOfPage: page,
    },
    {
      '@type': 'WebPage',
      ...page,
      name: site.title,
      url: site.canonical,
      description: site.description,
      inLanguage: 'en',
      isAccessibleForFree: true,
      mainEntity: app,
      isPartOf: website,
      author: person,
      publisher: organization,
      hasPart: { '@id': `${site.canonical}#faq` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${site.canonical}#faq`,
      url: `${site.canonical}#faq`,
      name: 'Streakfreak questions, answered',
      isPartOf: page,
      inLanguage: 'en',
      mainEntity: site.faqs.map(({ id, question, answer }) => ({
        '@type': 'Question',
        '@id': `${site.canonical}#${id}`,
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
  ],
};
