export function getWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TARDIS',
    url: 'https://app.tardis-ai.com',
    description:
      'AI-powered furniture visualizer. Upload a photo, generate a 3D model, and place it in your room using augmented reality.',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://app.tardis-ai.com/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };
}

export function getApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'TARDIS Furniture Visualizer',
    url: 'https://app.tardis-ai.com',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web, iOS, Android',
    description:
      'Upload a photo of any furniture and instantly generate a realistic 3D model using AI. Place it in your room with augmented reality on iPhone (LiDAR) or Android.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'AI-powered 3D model generation from photos',
      'Augmented reality furniture placement',
      'iPhone LiDAR room scanning',
      'Android ARCore support',
      'AI room preview visualization',
      'Similar furniture discovery across retailers',
    ],
    screenshot: 'https://app.tardis-ai.com/og.png',
    browserRequirements: 'Requires a modern web browser with WebGL support',
  };
}

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TARDIS',
    url: 'https://app.tardis-ai.com',
    email: 'tardis.ai.com@gmail.com',
    sameAs: [],
  };
}

export function getFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I see furniture in my room before buying?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Upload a photo of the furniture to TARDIS. Our AI generates a 3D model in minutes. Then use your phone camera to place it in your room using augmented reality — works on iPhone (LiDAR) and Android.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does TARDIS work with any furniture?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. TARDIS works with any furniture from any store. Simply upload a photo of the piece — a sofa, table, chair, shelf, or bed — and our AI will generate a 3D model you can view in AR.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need to download an app?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. TARDIS works directly in your browser. On iPhone and Android, AR viewing launches automatically from the web page — no app install required.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is TARDIS free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'TARDIS offers free 3D model generation. Sign up with your email to get started — no credit card required.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to generate a 3D model?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AI 3D model generation typically takes 2–5 minutes. Once generated, you can instantly view and place the model in your room using AR.',
        },
      },
    ],
  };
}
