const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath =
  rawBasePath && rawBasePath !== '/'
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
    : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: normalizedBasePath || undefined,
};

export default nextConfig;
