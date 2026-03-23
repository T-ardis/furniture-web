export interface DemoProduct {
  name: string;
  category: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  posterUrl: string;
  glbUrl: string;
  usdzUrl: string;
}

export const DEMO_PRODUCT: DemoProduct = {
  name: 'Modern Sofa',
  category: 'sofa',
  widthCm: 200,
  heightCm: 85,
  depthCm: 90,
  posterUrl: '/demo/sofa.webp',
  glbUrl: '/demo/sofa.glb',
  usdzUrl: '/demo/sofa.usdz',
};
