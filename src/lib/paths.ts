const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const BASE_PATH =
  rawBasePath && rawBasePath !== '/'
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
    : '';

export function withBasePath(path: string): string {
  if (!path) return BASE_PATH || '/';
  if (/^https?:\/\//.test(path)) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return BASE_PATH ? `${BASE_PATH}${normalizedPath}` : normalizedPath;
}
