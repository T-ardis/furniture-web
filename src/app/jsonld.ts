const ORG_ID = 'https://www.tardis-ai.com/#organization';

export function getWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TARDIS',
    url: 'https://app.tardis-ai.com',
    description:
      'AI-powered furniture visualizer. Upload a photo, generate a 3D model, and place it in your room using augmented reality.',
    publisher: { '@id': ORG_ID },
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
      'Upload a photo of any furniture and instantly generate a realistic 3D model using AI. Place it in your room with augmented reality on iPhone or Android.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'AI-powered 3D model generation from photos',
      'Augmented reality furniture placement',
      'Android ARCore support',
      'AI room preview visualization',
      'Similar furniture discovery across retailers',
    ],
    screenshot: 'https://app.tardis-ai.com/og.png',
    browserRequirements: 'Requires a modern web browser with WebGL support',
    publisher: { '@id': ORG_ID },
  };
}

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'TARDIS',
    url: 'https://www.tardis-ai.com',
    email: 'founders@tardis-ai.com',
    sameAs: ['https://app.tardis-ai.com'],
  };
}
