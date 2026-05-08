'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type {
  ProjectWithFields,
  ProjectTypeDefinition,
  ProjectPhase,
  ProjectNote,
  Todo,
  SidebarTabDefinition,
  ProjectContact,
  ProjectUser,
  AssetType,
  ProjectContentTemplate,
} from '@/types';
import { withBasePath } from '@/lib/paths';

const ProjectRelationsWidget = dynamic(() => import('@/components/ProjectRelationsWidget'), {
  ssr: false,
  loading: () => (
    <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
      <p className="text-sm">プロジェクト構成を準備中...</p>
    </div>
  ),
});

// ============================================================
// CopyIcon
// ============================================================
function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="8" height="10" rx="1.5" />
      <path d="M3.5 11.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5h5" />
    </svg>
  );
}

// ============================================================
// CopyableContactValue
// ============================================================
function CopyableContactValue({
  value,
  emptyLabel,
  compact = false,
}: {
  value: string;
  emptyLabel: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }

  async function copyValue(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopy(value)) {
        throw new Error('copy_failed');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      const success = fallbackCopy(value);
      setCopied(success);
      if (success) {
        window.setTimeout(() => setCopied(false), 1200);
      }
    }
  }

  if (!value) {
    return <span>{emptyLabel}</span>;
  }

  return (
    <span className={compact ? 'flex items-center gap-2 min-w-0 max-w-full' : 'flex items-start gap-2 min-w-0 max-w-full'}>
      <span className={compact ? 'min-w-0 truncate' : 'min-w-0 break-all whitespace-normal'}>{value}</span>
      <button
        type="button"
        onClick={copyValue}
        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border transition-opacity hover:opacity-70 shrink-0"
        style={{ borderColor: 'var(--border)' }}
        title="コピー"
        aria-label="コピー"
      >
        {copied ? '✓' : <CopyIcon size={11} />}
      </button>
    </span>
  );
}

// ============================================================
// NotePickerButton
// ============================================================
function NotePickerButton({
  notes,
  selectedIds,
  onChange,
}: {
  notes: ProjectNote[];
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const count = selectedIds.size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors"
        style={{
          borderColor: count > 0 ? 'var(--accent)' : 'var(--border)',
          color: count > 0 ? 'var(--accent)' : 'var(--text-secondary)',
          backgroundColor: count > 0 ? 'rgba(15,154,177,0.06)' : 'transparent',
        }}
      >
        <span>📎 参照ノート</span>
        {count > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-semibold" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
            {count}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 mt-1 w-72 rounded-xl border shadow-lg overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>参照するノートを選択</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[0.625rem] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                すべて解除
              </button>
            )}
          </div>
          {notes.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>ノートがありません</p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {notes.map((note) => (
                <label
                  key={note.id}
                  className="flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-[rgba(15,154,177,0.04)]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0 accent-cyan-600"
                    checked={selectedIds.has(note.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(note.id); else next.delete(note.id);
                      onChange(next);
                    }}
                  />
                  <span className="text-xs leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                    {note.title || '（無題）'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DecorationPlacement
// ============================================================
export function DecorationPlacement({ item, layout = 'full' }: { item: SidebarTabDefinition['items'][number]; layout?: 'half' | 'full' }) {
  const colClass = layout === 'full' ? 'col-span-2' : '';
  const kind = item.kind ?? 'field';

  if (kind === 'divider') {
    return (
      <div className={`${colClass} py-1`}>
        <div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} />
      </div>
    );
  }

  if (kind === 'spacer') {
    return <div className={`${colClass} h-4`} aria-hidden="true" />;
  }

  if (kind === 'subheading') {
    return (
      <div className={`${colClass} pt-1`}>
        <p className="text-sm font-semibold tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>
          {item.config?.title?.trim() || '小見出し'}
        </p>
      </div>
    );
  }

  if (kind === 'label_badge') {
    return (
      <div className={`${colClass} pt-1`}>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
          style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#0f8a63', border: '1px solid rgba(16,185,129,0.16)' }}
        >
          {item.config?.title?.trim() || 'ラベル'}
        </span>
      </div>
    );
  }

  if (kind === 'text_block') {
    return (
      <div className={`${colClass} rounded-xl px-3 py-2`} style={{ backgroundColor: 'rgba(255,255,255,0.48)', color: 'var(--text-secondary)' }}>
        <p className="text-xs whitespace-pre-wrap leading-relaxed">
          {item.config?.body?.trim() || '補足テキスト'}
        </p>
      </div>
    );
  }

  if (kind === 'callout') {
    return (
      <div className={`${colClass} rounded-xl px-3 py-2.5`} style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)' }}>
        <p className="text-xs font-semibold" style={{ color: '#b66a10' }}>{item.config?.title?.trim() || '案内'}</p>
        <p className="text-xs mt-1 whitespace-pre-wrap leading-relaxed" style={{ color: '#8a6215' }}>
          {item.config?.body?.trim() || '補足や注意を書けます。'}
        </p>
      </div>
    );
  }

  return null;
}

// ============================================================
// SectionInfoWidget props 型
// ============================================================
export interface SectionInfoWidgetProps {
  kind: string;
  layout: 'half' | 'full';
  project: ProjectWithFields;
  projectType: ProjectTypeDefinition | undefined;
  projectTypes: ProjectTypeDefinition[];
  phases: ProjectPhase[];
  typeLabel: string;
  notes?: ProjectNote[];
  todos?: Todo[];
  todosLoading?: boolean;
  members?: ProjectUser[];
  contacts?: ProjectContact[];
  canEditProject?: boolean;
  onStructureTabClick?: () => void;
  onProjectParentChange?: (parentProjectId: string | null) => void;
  onNotesTabClick?: () => void;
  onTasksTabClick?: () => void;
  currentContentTemplates?: ProjectContentTemplate[];
  canViewContent?: boolean;
  canGenerateContent?: boolean;
  generating?: boolean;
  selectedContentKeys?: AssetType[];
  setSelectedContentKeys?: (next: AssetType[] | ((current: AssetType[]) => AssetType[])) => void;
  generate?: () => void;
  additionalGenerationInstruction?: string;
  setAdditionalGenerationInstruction?: (next: string | ((current: string) => string)) => void;
  canViewNotes?: boolean;
  generateSelectedNoteIds?: Set<string>;
  setGenerateSelectedNoteIds?: (next: Set<string>) => void;
  completionAdditionalInstruction?: string;
  setCompletionAdditionalInstruction?: (next: string | ((current: string) => string)) => void;
  completionSelectedNoteIds?: Set<string>;
  setCompletionSelectedNoteIds?: (next: Set<string>) => void;
  complete?: () => void;
  completing?: boolean;
  completionMessage?: string;
  completionRawSnippet?: string;
  aiError?: string;
  inheritedCount?: number;
  router?: ReturnType<typeof useRouter>;
}

// ============================================================
// SectionInfoWidget
// ============================================================
export default function SectionInfoWidget({
  kind,
  layout,
  project,
  projectType,
  projectTypes,
  phases,
  typeLabel,
  notes,
  todos,
  todosLoading,
  members,
  contacts,
  canEditProject,
  onStructureTabClick,
  onProjectParentChange,
  onNotesTabClick,
  onTasksTabClick,
  currentContentTemplates,
  canViewContent,
  canGenerateContent,
  generating,
  selectedContentKeys,
  setSelectedContentKeys,
  generate,
  additionalGenerationInstruction,
  setAdditionalGenerationInstruction,
  canViewNotes,
  generateSelectedNoteIds,
  setGenerateSelectedNoteIds,
  completionAdditionalInstruction,
  setCompletionAdditionalInstruction,
  completionSelectedNoteIds,
  setCompletionSelectedNoteIds,
  complete,
  completing,
  completionMessage,
  completionRawSnippet,
  aiError,
  inheritedCount,
  router,
}: SectionInfoWidgetProps) {
  const colClass = layout === 'full' ? 'col-span-2' : '';
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  if (kind === 'project_type') {
    return (
      <div className={`${colClass} surface-read space-y-1`}>
        <p className="field-label">プロジェクト種別</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{typeLabel || '—'}</p>
        {projectType?.description && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{projectType.description}</p>
        )}
      </div>
    );
  }

  if (kind === 'phase') {
    const currentPhase = phases.find((p) => p.key === project.phase_key);
    return (
      <div className={`${colClass} surface-read space-y-1`}>
        <p className="field-label">進行フェーズ</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {currentPhase?.name || (phases.length === 0 ? '—' : '未設定')}
        </p>
      </div>
    );
  }

  if (kind === 'project_relations') {
    return (
      <div className={colClass}>
        <ProjectRelationsWidget
          projectId={project.id}
          projectTypes={projectTypes}
          canEdit={Boolean(canEditProject)}
          compact={layout !== 'full'}
          onOpenStructureTab={onStructureTabClick}
          onProjectParentChange={onProjectParentChange}
        />
      </div>
    );
  }

  if (kind === 'note_list') {
    const pinnedNotes = (notes ?? []).filter(n => n.pinned === 1).slice(0, 3);
    return (
      <div className={`${colClass} surface-read`}>
        <div className="flex items-center justify-between mb-2">
          <p className="field-label">ノート</p>
          {onNotesTabClick && (
            <button onClick={onNotesTabClick} className="text-xs transition-colors" style={{ color: 'var(--accent)' }}>
              すべて表示 →
            </button>
          )}
        </div>
        {pinnedNotes.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ピン留めされたノートはありません</p>
        ) : (
          <ul className="space-y-1.5">
            {pinnedNotes.map(note => (
              <li key={note.id} className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                <span className="mr-1" style={{ color: 'var(--accent)' }}>📌</span>
                {note.title || '（無題）'}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (kind === 'todo_list') {
    const STATUS_COLORS: Record<string, string> = { todo: '#94a3b8', in_progress: '#3b82f6', done: '#10b981' };
    const STATUS_LABELS: Record<string, string> = { todo: '未着手', in_progress: '進行中', done: '完了' };
    const activeTodos = (todos ?? []).filter(t => t.status !== 'done' && !t.parent_id).slice(0, 5);
    const totalActive = (todos ?? []).filter(t => t.status !== 'done' && !t.parent_id).length;
    return (
      <div className={`${colClass} surface-read`}>
        <div className="flex items-center justify-between mb-2">
          <p className="field-label">タスク一覧</p>
          {onTasksTabClick && (
            <button onClick={onTasksTabClick} className="text-xs transition-colors" style={{ color: 'var(--accent)' }}>
              すべて表示 →
            </button>
          )}
        </div>
        {todosLoading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
        ) : activeTodos.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>未完了のタスクはありません</p>
        ) : (
          <ul className="space-y-1.5">
            {activeTodos.map(todo => (
              <li key={todo.id} className="flex items-center gap-2 text-xs">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[todo.status] ?? '#94a3b8' }} />
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{todo.title}</span>
                <span className="shrink-0 text-[0.625rem] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLORS[todo.status] ?? '#94a3b8'}18`, color: STATUS_COLORS[todo.status] ?? '#94a3b8' }}>
                  {STATUS_LABELS[todo.status] ?? todo.status}
                </span>
              </li>
            ))}
            {totalActive > 5 && (
              <li className="text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>他 {totalActive - 5} 件...</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  if (kind === 'todo_summary') {
    const allTodos = (todos ?? []).filter(t => !t.parent_id);
    const done = allTodos.filter(t => t.status === 'done').length;
    const inProgress = allTodos.filter(t => t.status === 'in_progress').length;
    const notStarted = allTodos.filter(t => t.status === 'todo').length;
    const total = allTodos.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className={`${colClass} surface-read`}>
        <div className="flex items-center justify-between mb-3">
          <p className="field-label">タスクサマリー</p>
          {onTasksTabClick && (
            <button onClick={onTasksTabClick} className="text-xs transition-colors" style={{ color: 'var(--accent)' }}>
              詳細 →
            </button>
          )}
        </div>
        {todosLoading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
        ) : total === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>タスクがありません</p>
        ) : (
          <div className="space-y-3">
            {/* 積み上げプログレスバー */}
            <div className="space-y-1">
              <div className="flex h-2.5 rounded-full overflow-hidden gap-px" style={{ backgroundColor: 'var(--border)' }}>
                {done > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />}
                {inProgress > 0 && <div className="h-full bg-blue-400 transition-all" style={{ width: `${(inProgress / total) * 100}%` }} />}
              </div>
              <div className="flex items-center justify-between text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
                <span>完了率 <span className="font-semibold" style={{ color: '#10b981' }}>{pct}%</span></span>
                <span>全 {total} 件</span>
              </div>
            </div>
            {/* ステータス内訳 */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg py-1.5 px-1" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
                <p className="text-base font-bold leading-none" style={{ color: '#10b981' }}>{done}</p>
                <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>完了</p>
              </div>
              <div className="rounded-lg py-1.5 px-1" style={{ backgroundColor: 'rgba(59,130,246,0.08)' }}>
                <p className="text-base font-bold leading-none" style={{ color: '#3b82f6' }}>{inProgress}</p>
                <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>進行中</p>
              </div>
              <div className="rounded-lg py-1.5 px-1" style={{ backgroundColor: 'rgba(148,163,184,0.1)' }}>
                <p className="text-base font-bold leading-none" style={{ color: '#64748b' }}>{notStarted}</p>
                <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>未着手</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (kind === 'member_list') {
    const memberList = members ?? [];
    return (
      <div className={`${colClass} surface-read`}>
        <p className="field-label mb-2">メンバー</p>
        {memberList.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>メンバーがいません</p>
        ) : (
          <div className="space-y-1.5">
            {memberList.map(m => (
              <div
                key={m.id}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (expandedMemberId === m.id) return;
                    setExpandedMemberId(m.id);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                    <span>{m.name?.trim() || m.email}</span>
                  </div>
                </button>
                {expandedMemberId === m.id && (
                  <div className="mt-1.5 pl-3 text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <CopyableContactValue value={m.email} emptyLabel="メール未登録" />
                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(null)}
                        className="shrink-0"
                        title="閉じる"
                      >
                        ▲
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (kind === 'contact_list') {
    const contactList = contacts ?? [];
    return (
      <div className={`${colClass} surface-read`}>
        <p className="field-label mb-2">関係者</p>
        {contactList.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>関係者がいません</p>
        ) : (
          <div className="space-y-1.5">
            {contactList.map((contact) => (
              <div
                key={contact.id}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs"
                style={{ backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (expandedContactId === contact.id) return;
                    setExpandedContactId(contact.id);
                  }}
                  className="w-full text-left"
                >
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {contact.company_name ? `${contact.company_name} ${contact.name}` : contact.name}
                  </p>
                </button>
                {expandedContactId === contact.id && (
                  <div className="mt-1.5 space-y-1 text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p><CopyableContactValue value={contact.email} emptyLabel="メール未登録" /></p>
                        <p><CopyableContactValue value={contact.phone} emptyLabel="電話未登録" /></p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedContactId(null)}
                        className="shrink-0"
                        title="閉じる"
                      >
                        ▲
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (kind === 'ai_tools') {
    const contentTemplates = currentContentTemplates ?? [];
    const selectedKeys = selectedContentKeys ?? [];
    return (
      <div className={`${colClass} rounded-2xl border p-4 space-y-4`} style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(241,250,252,0.9) 100%)' }}>
        <div>
          <p className="section-title">生成・補完</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>生成・補完・参照スコープをまとめて扱います。</p>
        </div>

        {canViewContent && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>生成するコンテンツ</p>
            <div className="space-y-1.5">
              {contentTemplates.map((template) => (
                <label key={template.id} className="flex items-center gap-2.5 cursor-pointer group rounded-xl px-3 py-2 transition-colors bg-white/60 border" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(template.key)}
                    onChange={e => setSelectedContentKeys?.(prev => e.target.checked ? [...prev, template.key] : prev.filter(t => t !== template.key))}
                    className="accent-cyan-600"
                  />
                  <span className="text-sm transition-colors" style={{ color: selectedKeys.includes(template.key) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{template.name}</span>
                </label>
              ))}
              {contentTemplates.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  このプロジェクト種別には生成コンテンツ定義がありません。設定から追加してください。
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating || selectedKeys.length === 0 || !canGenerateContent}
          className="btn-primary w-full justify-center py-2.5"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-cyan-100 border-t-transparent rounded-full animate-spin" />
              生成中...
            </span>
          ) : `選択中の ${selectedKeys.length} 件を生成`}
        </button>

        <div className="space-y-3">
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>追加指示（任意）</p>
            <textarea
              className="field-input text-xs"
              rows={4}
              value={additionalGenerationInstruction ?? ''}
              onChange={(e) => setAdditionalGenerationInstruction?.(e.target.value)}
              placeholder="今回だけ反映したい条件や補足があれば入力"
            />
          </div>
          {canViewNotes && notes && notes.length > 0 && generateSelectedNoteIds && setGenerateSelectedNoteIds && (
            <NotePickerButton
              notes={notes}
              selectedIds={generateSelectedNoteIds}
              onChange={setGenerateSelectedNoteIds}
            />
          )}
        </div>

        {canGenerateContent && (
          <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>項目自動補完</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>既存の情報を元に、未入力項目の値をAIが推測します</p>

            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>追加指示（任意）</p>
              <textarea
                className="field-input text-xs"
                rows={3}
                value={completionAdditionalInstruction ?? ''}
                onChange={(e) => setCompletionAdditionalInstruction?.(e.target.value)}
                placeholder="補完時に考慮してほしい条件や背景を入力"
              />
            </div>

            {canViewNotes && notes && notes.length > 0 && completionSelectedNoteIds && setCompletionSelectedNoteIds && (
              <NotePickerButton
                notes={notes}
                selectedIds={completionSelectedNoteIds}
                onChange={setCompletionSelectedNoteIds}
              />
            )}

            <button onClick={complete} disabled={completing} className="btn-secondary w-full justify-center text-sm">
              {completing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                  分析中...
                </span>
              ) : 'AI補完を実行'}
            </button>
            {completionMessage && (
              <div className="p-3 rounded-xl border text-xs space-y-2" style={{ borderColor: 'rgba(222,91,91,0.24)', backgroundColor: 'rgba(255,243,243,0.9)', color: '#b34a4a' }}>
                <p>{completionMessage}</p>
                {completionRawSnippet && (
                  <details>
                    <summary className="cursor-pointer" style={{ color: '#9a3030' }}>AIの生の応答を見る</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all text-[0.625rem] leading-relaxed" style={{ color: '#7a2020' }}>{completionRawSnippet}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {aiError && (
          <div className="p-3 rounded-xl border" style={{ borderColor: 'rgba(222,91,91,0.24)', backgroundColor: 'rgba(255,243,243,0.9)', color: '#b34a4a' }}>
            <p className="text-xs font-semibold">AI実行エラー</p>
            <p className="text-xs mt-1">{aiError}</p>
            <button onClick={() => router?.push(withBasePath('/settings/ai'))} className="text-xs mt-2 transition-colors" style={{ color: 'var(--accent)' }}>
              AI設定を開く →
            </button>
          </div>
        )}

        <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mb-2 section-title">AIへの参照スコープ</p>
          <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li className="flex items-center gap-1.5"><span style={{ color: 'var(--success)' }}>✓</span> マスターデータ</li>
            <li className="flex items-center gap-1.5"><span style={{ color: 'var(--success)' }}>✓</span> プロジェクトコア情報</li>
            <li className="flex items-center gap-1.5"><span style={{ color: project.custom_fields.length > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {project.custom_fields.length > 0 ? '✓' : '−'}
            </span> 項目 ({project.custom_fields.length}件)</li>
            <li className="flex items-center gap-1.5"><span style={{ color: project.custom_fields.some(f => f.crawled_content) ? 'var(--success)' : 'var(--text-muted)' }}>
              {project.custom_fields.some(f => f.crawled_content) ? '✓' : '−'}
            </span> クロール済みURL</li>
          </ul>
        </div>

        {(inheritedCount ?? 0) > 0 && (
          <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 243, 224, 0.8)', borderColor: 'rgba(215,138,29,0.25)' }}>
            <p className="text-xs font-semibold" style={{ color: '#b66a10' }}>⚠ 継承項目あり</p>
            <p className="text-xs mt-1" style={{ color: '#9a6213' }}>{inheritedCount}件の項目が前回施策から継承されています。生成前に確認を推奨します。</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
