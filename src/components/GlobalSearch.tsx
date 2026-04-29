'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';

type SearchResultType = 'project' | 'todo' | 'note' | 'asset' | 'field';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  project_id: string;
  project_name: string;
  href: string;
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  project: 'プロジェクト',
  todo: 'タスク',
  note: 'ノート',
  asset: '生成コンテンツ',
  field: '項目',
};

export default function GlobalSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = query.trim();
  const groupedResults = useMemo(() => results.slice(0, 8), [results]);

  useEffect(() => {
    if (!user || trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(withBasePath(`/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=12`), {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json() as { results?: SearchResult[] };
        setResults(Array.isArray(data.results) ? data.results : []);
        setActiveIndex(0);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, user]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (!user) return null;

  function goToResult(result: SearchResult | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery('');
    router.push(withBasePath(result.href));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(groupedResults.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      goToResult(groupedResults[activeIndex]);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.86)' }}
      >
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>⌕</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-0 w-full bg-transparent text-xs outline-none placeholder:text-[0.6875rem]"
          style={{ color: 'var(--text-primary)' }}
          placeholder="横断検索"
          aria-label="横断検索"
        />
        {loading && <span className="shrink-0 text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>検索中</span>}
      </div>

      {open && trimmedQuery.length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border shadow-xl"
          style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.98)' }}
        >
          {groupedResults.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {loading ? '検索中...' : '該当する結果はありません'}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {groupedResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goToResult(result)}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: index === activeIndex ? 'rgba(15,154,177,0.08)' : 'transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="rounded-full px-2 py-0.5 text-[0.625rem] font-semibold" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                          {TYPE_LABELS[result.type]}
                        </span>
                        <span className="min-w-0 truncate text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
                          {result.project_name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {result.title}
                      </p>
                      {result.excerpt && (
                        <p className="mt-0.5 text-[0.6875rem] line-clamp-2 leading-snug" style={{ color: 'var(--text-muted)' }}>
                          {result.excerpt}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>開く</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
