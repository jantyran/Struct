'use client';

import { DependencyList, useEffect } from 'react';

export function usePendingScrollTarget(
  targetId: string | null,
  deps: DependencyList,
  clearTarget: (value: string | null) => void,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' },
) {
  useEffect(() => {
    if (!targetId) return;

    let cancelled = false;
    let frameId = 0;

    const tryScroll = () => {
      if (cancelled) return;
      const element = document.getElementById(targetId);
      if (!element) {
        frameId = window.requestAnimationFrame(tryScroll);
        return;
      }

      element.scrollIntoView(options);
      clearTarget(null);
    };

    frameId = window.requestAnimationFrame(tryScroll);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [targetId, clearTarget, options, ...deps]);
}
