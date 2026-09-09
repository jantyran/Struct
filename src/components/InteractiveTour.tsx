'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';

export interface TourStep {
  targetSelector?: string; // 指定がない場合は画面中央モーダル
  title: string;
  description: string;
  badge?: string;
  actionText?: string;
  actionHref?: string;
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'center';
}

const DEFAULT_STEPS: TourStep[] = [
  {
    title: 'Struct へようこそ！',
    badge: 'Step 1 / 6',
    description: 'Struct は、プロジェクト情報・タスク・ノート・チームをひとつの場所で構造化して管理できるワークスペースです。主要な機能を1分でご案内します。',
    placement: 'center',
  },
  {
    targetSelector: '[data-tour="global-search"]',
    title: '横断検索 (Cmd+K / Ctrl+K)',
    badge: 'Step 2 / 6',
    description: 'プロジェクト、タスク、ノート、AI生成コンテンツ、マスターデータまで、ワークスペース内のあらゆる情報を瞬時に横断検索できます。',
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="status-tabs"]',
    title: 'プロジェクトステータス切り替え',
    badge: 'Step 3 / 6',
    description: 'デフォルトは進行中の「アクティブ」プロジェクトを表示。「下書き」「完了」「全プロジェクト」「アーカイブ」に素早く切り替えられます。',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour="new-project-btn"]',
    title: '新規プロジェクト作成 & 公開設定',
    badge: 'Step 4 / 6',
    description: 'キャンペーンやイベント等の種別を選んで作成できます。「公開」「チーム限定」「プライベート」の公開範囲を設定して安全に共有できます。',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour="team-nav"]',
    title: 'チーム管理 & 進捗ダッシュボード',
    badge: 'Step 5 / 6',
    description: '組織内のグループごとにチームを作り、メンバーのタスク負荷やプロジェクト進捗を一覧で把握できます。',
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="onboarding-section"]',
    title: '練習プロジェクトで体験しよう',
    badge: 'Step 6 / 6',
    description: 'まずは自由に触って壊しても安心な「練習プロジェクト」で、タスクの進捗変更やタブ設定、コメント機能を体験してみましょう！',
    placement: 'bottom',
    actionText: '練習プロジェクトを開く →',
  },
];

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  steps?: TourStep[];
  primaryProjectId?: string;
}

export function InteractiveTour({
  isOpen,
  onClose,
  onComplete,
  steps = DEFAULT_STEPS,
  primaryProjectId,
}: InteractiveTourProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStepIndex];

  // ターゲット要素の位置測定とスクロール
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !step) return;

    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      // 見つからない場合は画面中央表示にフォールバック
      setTargetRect(null);
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setTargetRect(null);
      return;
    }

    // 要素の位置測定
    updateTargetRect();

    const handleResize = () => updateTargetRect();
    const handleScroll = () => {
      if (step?.targetSelector) {
        const el = document.querySelector(step.targetSelector);
        if (el) setTargetRect(el.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    const timer = setTimeout(updateTargetRect, 200);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeout(timer);
    };
  }, [isOpen, currentStepIndex, updateTargetRect, step]);

  // キーボード操作 (Esc で終了, 左右キーで移動)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  if (!isOpen || !step) return null;

  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      if (onComplete) onComplete();
      onClose();
      if (step.actionText && primaryProjectId) {
        router.push(withBasePath(`/projects/${primaryProjectId}`));
      }
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleActionClick = () => {
    if (onComplete) onComplete();
    onClose();
    if (primaryProjectId) {
      router.push(withBasePath(`/projects/${primaryProjectId}`));
    } else if (step.actionHref) {
      router.push(withBasePath(step.actionHref));
    }
  };

  // ポップオーバーの配置座標計算
  const getPopoverStyle = (): React.CSSProperties => {
    if (!targetRect || step.placement === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        maxWidth: '440px',
        width: '90vw',
      };
    }

    const padding = 16;
    const placement = step.placement || 'bottom';
    let top = 0;
    let left = 0;

    if (placement === 'bottom') {
      top = targetRect.bottom + padding;
      left = Math.max(padding, Math.min(window.innerWidth - 420, targetRect.left));
    } else if (placement === 'top') {
      top = Math.max(padding, targetRect.top - 240);
      left = Math.max(padding, Math.min(window.innerWidth - 420, targetRect.left));
    } else if (placement === 'right') {
      top = Math.max(padding, targetRect.top);
      left = Math.min(window.innerWidth - 420, targetRect.right + padding);
    } else if (placement === 'left') {
      top = Math.max(padding, targetRect.top);
      left = Math.max(padding, targetRect.left - 420);
    }

    // 画面外はみ出し防止
    top = Math.min(window.innerHeight - 260, Math.max(padding, top));
    left = Math.min(window.innerWidth - 420, Math.max(padding, left));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100,
      width: '400px',
      maxWidth: '92vw',
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      {/* 背景の暗転オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/55 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* スポットライト枠（ハイライト対象がある場合） */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 rounded-xl"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 15px rgba(15, 154, 177, 0.8)',
            border: '2px solid rgba(126, 215, 222, 0.9)',
            zIndex: 90,
          }}
        />
      )}

      {/* ポップオーバーカード */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="bg-white rounded-2xl shadow-2xl border border-cyan-200/80 p-5 text-gray-800 transition-all duration-300 flex flex-col gap-3"
      >
        {/* ヘッダー・ステップバッジ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-cyan-100 text-cyan-800">
              {step.badge || `Step ${currentStepIndex + 1} / ${steps.length}`}
            </span>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStepIndex
                      ? 'w-5 bg-cyan-600'
                      : i < currentStepIndex
                      ? 'w-1.5 bg-cyan-300'
                      : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100"
            title="ツアーを閉じる (Esc)"
          >
            ✕
          </button>
        </div>

        {/* タイトルと説明 */}
        <div>
          <h3 className="text-base font-bold text-gray-900 leading-snug">{step.title}</h3>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{step.description}</p>
        </div>

        {/* アクションボタン */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 underline font-medium"
          >
            ツアーをスキップ
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                ← 前へ
              </button>
            )}

            {isLast && step.actionText ? (
              <button
                type="button"
                onClick={handleActionClick}
                className="btn-primary text-xs py-1.5 px-4 bg-gradient-to-r from-cyan-600 to-teal-500 font-bold shadow-md hover:shadow-lg"
              >
                {step.actionText}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary text-xs py-1.5 px-4"
              >
                {isLast ? '完了する ✓' : '次へ →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
