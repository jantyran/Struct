import path from 'path';
import { fileURLToPath } from 'url';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath =
  rawBasePath && rawBasePath !== '/'
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
    : '';

export default function nextConfig(phase) {
  const noStoreHeaders = [
    {
      key: 'Cache-Control',
      value: 'private, no-cache, no-store, max-age=0, must-revalidate',
    },
  ];

  return {
    ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    outputFileTracingRoot: __dirname,
    async headers() {
      return [
        { source: '/', headers: noStoreHeaders },
        { source: '/projects/:path*', headers: noStoreHeaders },
      ];
    },
    webpack(config) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
      };
      return config;
    },
  };
}
