'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Comment, CommentTargetType } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

interface CommentSectionProps {
  projectId: string;
  targetType: CommentTargetType;
  targetId: string;
  targetTitle?: string;
  compact?: boolean;
  onCommentCountChange?: (count: number) => void;
}

export function CommentSection({
  projectId,
  targetType,
  targetId,
  targetTitle,
  compact = false,
  onCommentCountChange,
}: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!projectId || !targetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        withBasePath(`/api/projects/${projectId}/comments?target_type=${targetType}&target_id=${targetId}`)
      );
      if (!res.ok) throw new Error('コメントの取得に失敗しました');
      const data = (await res.json()) as Comment[];
      setComments(data);
      onCommentCountChange?.(data.length);
    } catch (err) {
      console.error(err);
      setError('コメントの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [projectId, targetType, targetId, onCommentCountChange]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(withBasePath(`/api/projects/${projectId}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          content: trimmed,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'コメントの投稿に失敗しました');
      }
      const newComment = (await res.json()) as Comment;
      const updated = [...comments, newComment];
      setComments(updated);
      setContent('');
      onCommentCountChange?.(updated.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '投稿に失敗しました';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('このコメントを削除してもよろしいですか？')) return;
    try {
      const res = await fetch(
        withBasePath(`/api/projects/${projectId}/comments/${commentId}`),
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('削除に失敗しました');
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      onCommentCountChange?.(updated.length);
    } catch (err) {
      console.error(err);
      alert('コメントの削除に失敗しました');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatTimestamp = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
  };

  return (
    <div className={`flex flex-col h-full ${compact ? 'text-xs' : 'text-sm'}`}>
      {targetTitle && (
        <div className="pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 font-medium">コメント対象</div>
          <div className="font-semibold truncate text-gray-800 dark:text-gray-200">{targetTitle}</div>
        </div>
      )}

      {/* コメントリスト */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 max-h-[380px] min-h-[120px]">
        {loading ? (
          <div className="text-center py-6 text-gray-400">コメントを読み込み中...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            💬 まだコメントはありません。<br />
            <span className="text-xs text-gray-400">ディスカッションやメモを残してみましょう。</span>
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = user?.id === comment.user_id;
            const displayName = comment.user_name || comment.user_email || 'ユーザー';
            const initial = displayName.charAt(0).toUpperCase();

            return (
              <div
                key={comment.id}
                className="group flex gap-2.5 p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 dark:bg-gray-800/40 dark:hover:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 transition-colors"
              >
                {/* アバター */}
                <div className="shrink-0">
                  {comment.user_avatar_url ? (
                    <img
                      src={comment.user_avatar_url}
                      alt={displayName}
                      className="w-7 h-7 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-cyan-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
                      {initial}
                    </div>
                  )}
                </div>

                {/* 本文エリア */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
                        {displayName}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 font-medium">
                          あなた
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {formatTimestamp(comment.created_at)}
                      </span>
                    </div>

                    {/* 削除ボタン */}
                    {(isMe || user?.system_role === 'SYSTEM_ADMIN') && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity p-0.5 rounded text-xs"
                        title="コメントを削除"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed text-[13px]">
                    {comment.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="text-xs text-red-500 mt-1 px-1">{error}</div>
      )}

      {/* 投稿フォーム */}
      <form onSubmit={handleSubmit} className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="コメントを入力... (Cmd+Enter または Ctrl+Enter で送信)"
            rows={compact ? 2 : 3}
            className="w-full text-xs sm:text-sm p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 resize-none transition-shadow"
            disabled={submitting}
          />
          <div className="flex justify-between items-center mt-1.5 px-0.5">
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              ⌘+Enter で送信
            </span>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-xs transition-colors flex items-center gap-1"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <span>💬</span>
                  <span>送信</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
