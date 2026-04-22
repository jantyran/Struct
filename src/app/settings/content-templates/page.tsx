'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectContentTemplate } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { CONTENT_CHANNEL_OPTIONS, createContentTemplate } from '@/lib/content-templates';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';

function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}


function ContentTemplateRow({
  template,
  expanded,
  dragging,
  onDragStart,
  onDrop,
  onToggle,
  onChange,
  onRemove,
}: {
  template: ProjectContentTemplate;
  expanded: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onToggle: () => void;
  onChange: (template: ProjectContentTemplate) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`rounded-md border overflow-hidden ${dragging ? 'opacity-60' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="row-hover w-full px-4 py-4 flex items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm cursor-grab select-none" style={{ color: 'var(--text-muted)' }}>⋮⋮</span>
            <span className="text-sm font-semibold">{template.name || '未命名の生成コンテンツ'}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.14)', color: 'rgb(196,181,253)' }}>
              {template.channel === 'その他' ? (template.channel_other || 'その他') : template.channel || 'チャネル未設定'}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            形式: {template.text_format === 'plain' ? 'プレーンテキスト' : 'Markdown'} ・ トーン: {template.tone || '未設定'}
          </p>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {template.instruction || '生成指示未設定'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{expanded ? '▲ 閉じる' : '▼ 開く'}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-danger">削除</button>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <label className="field-label">生成名</label>
              <input className="field-input text-sm" value={template.name} onChange={(e) => onChange({ ...template, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">キー</label>
              <input className="field-input text-sm" value={template.key} onChange={(e) => onChange({ ...template, key: e.target.value.replace(/\s+/g, '_') })} />
            </div>
            <div>
              <label className="field-label">チャネル</label>
              <select className="field-input text-sm" value={template.channel} onChange={(e) => onChange({ ...template, channel: e.target.value })}>
                {CONTENT_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">テキスト形式</label>
              <select className="field-input text-sm" value={template.text_format} onChange={(e) => onChange({ ...template, text_format: e.target.value as ProjectContentTemplate['text_format'] })}>
                <option value="plain">プレーンテキスト</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          </div>

          {template.channel === 'その他' && (
            <div>
              <label className="field-label">チャネル名（自由入力）</label>
              <input className="field-input text-sm" value={template.channel_other} onChange={(e) => onChange({ ...template, channel_other: e.target.value })} placeholder="例: note / セミナー台本 / 営業資料" />
            </div>
          )}

          <div>
            <label className="field-label">必須要素</label>
            <textarea className="field-input text-sm" rows={3} value={template.mandatory_elements} onChange={(e) => onChange({ ...template, mandatory_elements: e.target.value })} placeholder="例: CTA、対象者、期限、ベネフィット" />
          </div>

          <div>
            <label className="field-label">トーン</label>
            <textarea className="field-input text-sm" rows={3} value={template.tone} onChange={(e) => onChange({ ...template, tone: e.target.value })} placeholder="例: 前向き、信頼感、簡潔、専門的" />
          </div>

          <div>
            <label className="field-label">望ましい構成例</label>
            <textarea className="field-input text-sm" rows={3} value={template.example_structure} onChange={(e) => onChange({ ...template, example_structure: e.target.value })} placeholder="例: 件名 / 導入 / 本文 / CTA" />
          </div>

          <div>
            <label className="field-label">個別生成指示</label>
            <textarea
              className="field-input text-sm"
              rows={5}
              value={template.instruction}
              onChange={(e) => onChange({ ...template, instruction: e.target.value })}
              placeholder="上記の構造化設定では足りない固有の条件や禁止事項を記述"
            />
          </div>

        </div>
      )}
    </div>
  );
}

export default function ContentTemplatesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageProjectSettings = Boolean(user?.system_permissions?.manage_project_settings);
  const [templates, setTemplates] = useState<ProjectContentTemplate[]>([]);
  const [openTemplateIds, setOpenTemplateIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [pendingTemplateScrollTarget, setPendingTemplateScrollTarget] = useState<string | null>(null);
  const scrollOptions = useMemo(() => ({ behavior: 'smooth', block: 'center' } as const), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    if (!user.system_permissions?.manage_project_settings) {
      router.push(withBasePath('/settings'));
      return;
    }

    (async () => {
      const res = await fetch(withBasePath('/api/content-templates'));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 403) {
        router.push(withBasePath('/settings'));
        return;
      }
      const payload = await res.json();
      if (!res.ok) return;
      const nextTemplates = Array.isArray(payload.content_templates) ? payload.content_templates : [];
      setTemplates(nextTemplates);
      setOpenTemplateIds((current) => current.length > 0 ? current : []);
    })();
  }, [authLoading, router, user]);

  usePendingScrollTarget(
    pendingTemplateScrollTarget,
    [templates],
    setPendingTemplateScrollTarget,
    scrollOptions,
  );

  function addTemplate() {
    const nextTemplate = createContentTemplate({ id: uuidv4(), key: `content_${templates.length + 1}` });
    setTemplates((current) => [...current, nextTemplate]);
    setOpenTemplateIds((current) => [...current, nextTemplate.id]);
    setPendingTemplateScrollTarget(`content-template-row-${nextTemplate.id}`);
  }

  useRegisterShortcutScope('settings-content-templates', '生成コンテンツ設定', {
    save_current: canManageProjectSettings ? () => save() : undefined,
    new_record: canManageProjectSettings ? addTemplate : undefined,
  });

  async function save(nextTemplates = templates) {
    setSaving(true);
    const res = await fetch(withBasePath('/api/content-templates'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_templates: nextTemplates }),
    });
    const payload = await res.json();
    setSaving(false);

    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.status === 403) {
      router.push(withBasePath('/settings'));
      return;
    }
    if (!res.ok) {
      return;
    }

    setTemplates(Array.isArray(payload.content_templates) ? payload.content_templates : nextTemplates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (authLoading || !user) {
    return <div className="p-6 max-w-5xl mx-auto"><div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div></div>;
  }

  if (!canManageProjectSettings) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">生成コンテンツ設定</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              プロジェクト設定管理権限がないため、このページは表示できません。
            </p>
          </div>
          <div>
            <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
              ← 設定へ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">生成コンテンツ設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            プロジェクト種別から選択する生成コンテンツの定義を管理します。チャネル、対象、目的、出力要件を構造化してAIに渡せます。
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
            ← 設定へ戻る
          </button>
          <button
            onClick={addTemplate}
            className="btn-secondary"
          >
            + コンテンツ追加
          </button>
          <button onClick={() => save()} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {templates.length === 0 && (
          <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            まだ生成コンテンツ定義がありません。まずは `+ コンテンツ追加` から作成してください。
          </div>
        )}
        {templates.map((template, index) => (
          <div key={template.id} id={`content-template-row-${template.id}`}>
            <ContentTemplateRow
              template={template}
              expanded={openTemplateIds.includes(template.id)}
              dragging={draggingIndex === index}
              onDragStart={() => setDraggingIndex(index)}
              onDrop={() => {
                if (draggingIndex === null || draggingIndex === index) return;
                setTemplates((current) => reorderList(current, draggingIndex, index));
                setDraggingIndex(null);
              }}
              onToggle={() => setOpenTemplateIds((current) => current.includes(template.id) ? current.filter((id) => id !== template.id) : [...current, template.id])}
              onChange={(nextTemplate) => {
                const nextTemplates = [...templates];
                nextTemplates[index] = nextTemplate;
                setTemplates(nextTemplates);
              }}
              onRemove={() => {
                setTemplates((current) => current.filter((_, currentIndex) => currentIndex !== index));
                setOpenTemplateIds((current) => current.filter((id) => id !== template.id));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
