'use client';

import React, { useState, useEffect } from 'react';
import type { ProjectDetailTabKey } from '@/types';

export interface TabConfigItem {
  key: ProjectDetailTabKey;
  label: string;
  available: boolean;
}

interface TabSettingsModalProps {
  open: boolean;
  onClose: () => void;
  availableTabs: TabConfigItem[];
  currentOrder: ProjectDetailTabKey[];
  currentHidden: ProjectDetailTabKey[];
  onSave: (order: ProjectDetailTabKey[], hidden: ProjectDetailTabKey[]) => void;
  onReset: () => void;
}

export function TabSettingsModal({
  open,
  onClose,
  availableTabs,
  currentOrder,
  currentHidden,
  onSave,
  onReset,
}: TabSettingsModalProps) {
  const [order, setOrder] = useState<ProjectDetailTabKey[]>([]);
  const [hidden, setHidden] = useState<Set<ProjectDetailTabKey>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    // 有効なタブキー順を初期化
    const availableKeys = availableTabs.map((t) => t.key);
    const validOrder = currentOrder.filter((k) => availableKeys.includes(k));
    // 漏れているものがあれば末尾に追加
    for (const k of availableKeys) {
      if (!validOrder.includes(k)) validOrder.push(k);
    }
    setOrder(validOrder);
    setHidden(new Set(currentHidden));
  }, [open, availableTabs, currentOrder, currentHidden]);

  if (!open) return null;

  const labelMap = Object.fromEntries(availableTabs.map((t) => [t.key, t.label]));

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setOrder(next);
  };

  const handleDropItem = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= order.length || toIdx >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrder(next);
  };

  const toggleHidden = (key: ProjectDetailTabKey) => {
    const next = new Set(hidden);
    if (next.has(key)) {
      next.delete(key);
    } else {
      // 最低1つは表示されている必要がある
      if (order.length - next.size <= 1) {
        alert('最低1つのタブを表示しておく必要があります');
        return;
      }
      next.add(key);
    }
    setHidden(next);
  };

  const handleSave = () => {
    onSave(order, Array.from(hidden));
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('タブの並び順と表示設定を初期状態に戻しますか？')) {
      onReset();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-bold text-gray-900">タブの並び替え・表示設定</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ドラッグ＆ドロップまたはボタンで並び順を変更できます。
            </p>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        {/* タブ一覧 */}
        <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
          {order.map((key, index) => {
            const isHidden = hidden.has(key);
            const label = labelMap[key] || key;
            const isDragging = dragIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                  setDragIndex(index);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) {
                    handleDropItem(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                  isDragging
                    ? 'opacity-30 scale-95 border-cyan-400 bg-cyan-50'
                    : isDragOver
                      ? 'border-cyan-500 bg-cyan-50/50 shadow-md ring-2 ring-cyan-200'
                      : isHidden
                        ? 'bg-gray-50/60 border-dashed border-gray-300 opacity-60'
                        : 'bg-white border-gray-200/80 shadow-xs hover:border-gray-300'
                }`}
              >
                {/* ドラッグハンドル + チェックボックス + ラベル */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-gray-400 hover:text-gray-600 shrink-0 text-xs px-0.5 tracking-tighter" title="ドラッグして並び替え">
                    ⋮⋮
                  </span>
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleHidden(key)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="min-w-0">
                      <span className={`text-sm font-semibold truncate ${isHidden ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {label}
                      </span>
                      {isHidden && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-gray-200 text-gray-600">
                          非表示
                        </span>
                      )}
                    </div>
                  </label>
                </div>

                {/* 移動ボタン */}
                <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    className="p-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="上に移動"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === order.length - 1}
                    className="p-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="下に移動"
                  >
                    ▼
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-gray-50/50" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-cyan-700 hover:underline"
          >
            初期順に戻す
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              キャンセル
            </button>
            <button type="button" onClick={handleSave} className="btn-primary text-xs">
              設定を保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
