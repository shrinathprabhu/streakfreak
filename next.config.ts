import type { NextConfig } from 'next';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (basePath && !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(basePath))
  throw new Error(
    'NEXT_PUBLIC_BASE_PATH must be a path such as /streakfreak, without a trailing slash.',
  );
// Export the root route, then scope its public asset URLs in build-pwa.mjs.
// Vinext currently skips the root prerender when nextConfig.basePath is set.
const nextConfig: NextConfig = { output: 'export' };
export default nextConfig;
