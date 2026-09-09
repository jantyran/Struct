'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { GeneratedAsset } from '@/types';
import { withBasePath } from '@/lib/paths';
import { CommentSection } from '@/components/CommentSection';

const MarkdownRichTextEditor = dynamic(
  () => import('@/components/MarkdownRichTextEditor').then((mod) => mod.MarkdownRichTextEditor),
  {
    ssr: false,
    loading: () => <p className="text-xs" style={{ color: 'var(--text-muted)' }}>エディタを準備中...</p>,
  }
);

const MarkdownViewer = dynamic(() => import('@/components/MarkdownViewer'), {
  ssr: false,
  loading: () => <p className="text-xs" style={{ color: 'var(--text-muted)' }}>本文を準備中...</p>,
});

export interface AssetCardProps {
  asset: GeneratedAsset;
  onDelete: () => void;
  onSaved: (nextAsset: GeneratedAsset) => void;
  onDirtyChange?: (assetId: string, dirty: boolean) => void;
}

export default function AssetCard({
  asset,
  onDelete,
  onSaved,
  onDirtyChange,
}: AssetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [draftTitle, setDraftTitle] = useState(asset.title);
  const [draftContent, setDraftContent] = useState(asset.content);
  const [saving, setSaving] = useState(false);
  const warnings = (() => { try { return JSON.parse(asset.warnings) as string[]; } catch { return []; } })();

  useEffect(() => {
    setDraftTitle(asset.title);
    setDraftContent(asset.content);
  }, [asset.title, asset.content]);

  const isDirty = draftTitle !== asset.title || draftContent !== asset.content;

  useEffect(() => {
    onDirtyChange?.(asset.id, isDirty);
    return () => onDirtyChange?.(asset.id, false);
  }, [asset.id, isDirty, onDirtyChange]);

  function copy() {
    navigator.clipboard.writeText(asset.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${asset.project_id}/assets`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, title: draftTitle, content: draftContent }),
      });
      const payload = await res.json();
      if (!res.ok) return;
      onSaved(payload as GeneratedAsset);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b cursor-pointer" style={{ borderColor: 'var(--border)' }} onClick={() => setExpanded(e => !e)}>
        <div>
          <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{asset.title}</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(asset.created_at).toLocaleString('ja-JP')}</p>
        </div>
        <div className="flex items-center gap-2">
          {warnings.length > 0 && <span className="text-xs" style={{ color: '#b66a10' }}>⚠ {warnings.length}件</span>}
          <span style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4">
          {warnings.length > 0 && (
            <div className="mb-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 243, 224, 0.8)', borderColor: 'rgba(215,138,29,0.25)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#b66a10' }}>整合性チェック</p>
              <ul className="text-xs space-y-0.5" style={{ color: '#9a6213' }}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {editing ? (
            <div className="space-y-3">
              <MarkdownRichTextEditor
                title={draftTitle}
                body={draftContent}
                onTitleChange={setDraftTitle}
                onBodyChange={setDraftContent}
                onSave={saveEdit}
                onCancel={() => {
                  setDraftTitle(asset.title);
                  setDraftContent(asset.content);
                  setEditing(false);
                }}
                bodyLabel="内容"
                saveLabel={saving ? '保存中...' : '保存'}
                minHeight={320}
                isDirty={isDirty}
              />
            </div>
          ) : (
            <MarkdownViewer content={asset.content} className="text-sm" />
          )}
          {!editing && (
            <>
              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-2">
                  <button onClick={copy} className="btn-secondary text-xs">{copied ? '✓ コピー済み' : 'コピー'}</button>
                  <button onClick={() => setEditing(true)} className="btn-secondary text-xs">編集</button>
                  <button onClick={onDelete} className="btn-danger">削除</button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComments((v) => !v)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 font-medium ${
                    showComments
                      ? 'bg-cyan-100 text-cyan-800'
                      : 'text-gray-600 hover:text-cyan-700 hover:bg-gray-100'
                  }`}
                >
                  💬 コメント {showComments ? 'を閉じる' : ''}
                </button>
              </div>

              {showComments && (
                <div className="mt-3 p-3 bg-gray-50/70 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <CommentSection
                    projectId={asset.project_id}
                    targetType="generated_asset"
                    targetId={asset.id}
                    targetTitle={`生成コンテンツ: ${asset.title}`}
                    compact={true}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
