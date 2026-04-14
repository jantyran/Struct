'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectWithFields, CustomField, GeneratedAsset, AssetType, FieldType, CompletionSuggestion, ProjectTypeDefinition, GlobalAssetObject, ProjectType, ProjectContentTemplate, ProjectFieldTemplate } from '@/types';
import { FIELD_TYPE_LABELS, PROJECT_TYPE_LABELS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

function normalizeProject(project: ProjectWithFields): ProjectWithFields {
  return {
    ...project,
    custom_fields: Array.isArray(project?.custom_fields) ? project.custom_fields : [],
    members: Array.isArray(project?.members) ? project.members : [],
    invitations: Array.isArray(project?.invitations) ? project.invitations : [],
  };
}

function parseFieldOptions(options: string) {
  try {
    const parsed = JSON.parse(options || '{}');
    if (Array.isArray(parsed)) {
      return { choices: parsed as string[] };
    }
    return parsed as { choices?: string[]; referenceObjectId?: string; referenceRecordKey?: string; referenceRecordKeys?: string[]; children?: ProjectFieldTemplate[] };
  } catch {
    return {};
  }
}

type GroupChildState = { value: string; options?: string };

function normalizeGroupChildState(value: unknown): GroupChildState {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in (value as Record<string, unknown>)) {
    return {
      value: typeof (value as Record<string, unknown>).value === 'string' ? String((value as Record<string, unknown>).value) : '',
      options: typeof (value as Record<string, unknown>).options === 'string' ? String((value as Record<string, unknown>).options) : undefined,
    };
  }
  return { value: typeof value === 'string' ? value : '' };
}

function parseGroupValue(value: string) {
  try {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, childValue]) => [key, normalizeGroupChildState(childValue)])) as Record<string, GroupChildState>;
  } catch {
    return {};
  }
}

function parseGroupListValue(value: string) {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => Object.fromEntries(Object.entries(item).map(([key, childValue]) => [key, normalizeGroupChildState(childValue)])) as Record<string, GroupChildState>);
  } catch {
    return [];
  }
}

function buildChildField(childTemplate: ProjectFieldTemplate, state: GroupChildState | undefined, inherited = 0): CustomField {
  return {
    ...childTemplate,
    project_id: '',
    value: state?.value || '',
    options: state?.options || childTemplate.options,
    inherited,
    inherited_from: null,
    crawled_content: null,
    sort_order: 0,
  };
}

function ChildFieldValueInput({
  field,
  globalAssetObjects,
  onChange,
}: {
  field: CustomField;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (field: CustomField) => void;
}) {
  const options = parseFieldOptions(field.options);
  const referenceObject = globalAssetObjects.find((object) => object.id === options.referenceObjectId);
  const referenceChoices = referenceObject?.records ?? [];
  const selectedReferenceRecords = referenceChoices.filter((record) => (options.referenceRecordKeys ?? []).includes(record.key));
  const availableReferenceChoices = referenceChoices.filter((record) => !(options.referenceRecordKeys ?? []).includes(record.key));
  const childTemplates = options.children ?? [];
  const groupValue = parseGroupValue(field.value);
  const groupListValue = parseGroupListValue(field.value);

  return (
    <div className={field.layout === 'full' ? 'md:col-span-2' : ''}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{field.label}</p>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {FIELD_TYPE_LABELS[field.type] || field.type}
          </span>
          {(field.type === 'reference' || field.type === 'reference_multi') && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              ・ {referenceObject?.name || '未設定'}
            </span>
          )}
        </div>

        {field.type === 'reference' && (
          <select
            className="field-input text-xs"
            value={options.referenceRecordKey || ''}
            onChange={(e) => {
              const record = referenceChoices.find((choice) => choice.key === e.target.value);
              onChange({
                ...field,
                value: record?.name || '',
                options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKey: e.target.value }),
              });
            }}
          >
            <option value="">（選択してください）</option>
            {referenceChoices.map((record) => (
              <option key={record.id} value={record.key}>{record.name}</option>
            ))}
          </select>
        )}

        {field.type === 'reference_multi' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="field-label mb-0 shrink-0">参照レコードを追加</label>
              <select
                className="field-input text-xs"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const nextKeys = [...(options.referenceRecordKeys ?? []), e.target.value];
                  const nextRecords = referenceChoices.filter((record) => nextKeys.includes(record.key));
                  onChange({
                    ...field,
                    value: nextRecords.map((record) => record.name).join(' / '),
                    options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKeys: nextKeys }),
                  });
                }}
              >
                <option value="">（追加するレコードを選択）</option>
                {availableReferenceChoices.map((record) => (
                  <option key={record.id} value={record.key}>{record.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {selectedReferenceRecords.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ参照レコードは選択されていません。</div>
              ) : (
                selectedReferenceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs bg-white/70" style={{ borderColor: 'var(--border)' }}>
                    <span>{record.name}</span>
                    <button
                      type="button"
                      className="transition-colors"
                      style={{ color: '#cc5c6d' }}
                      onClick={() => {
                        const nextKeys = (options.referenceRecordKeys ?? []).filter((key) => key !== record.key);
                        const nextRecords = referenceChoices.filter((choice) => nextKeys.includes(choice.key));
                        onChange({
                          ...field,
                          value: nextRecords.map((choice) => choice.name).join(' / '),
                          options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKeys: nextKeys }),
                        });
                      }}
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {field.type !== 'reference' && field.type !== 'reference_multi' && (
          field.type === 'textarea' ? (
            <textarea className="field-input text-xs" rows={3} value={field.value} onChange={(e) => onChange({ ...field, value: e.target.value })} />
          ) : field.type === 'select' ? (
            <select className="field-input text-xs" value={field.value} onChange={(e) => onChange({ ...field, value: e.target.value })}>
              <option value="">（選択してください）</option>
              {(options.choices ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              className="field-input text-xs"
              type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
              value={field.value}
              onChange={(e) => onChange({ ...field, value: e.target.value })}
            />
          )
        )}
      </div>
    </div>
  );
}

// ============================================================
// プロジェクトフィールド入力
// ============================================================
function CustomFieldRow({ field, globalAssetObjects, onChange, onCrawl, crawling }: {
  field: CustomField;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (f: CustomField) => void;
  onCrawl: () => void;
  crawling: boolean;
}) {
  const isInherited = field.inherited === 1;
  const options = parseFieldOptions(field.options);
  const referenceObject = globalAssetObjects.find((object) => object.id === options.referenceObjectId);
  const referenceChoices = referenceObject?.records ?? [];
  const selectedReferenceRecords = referenceChoices.filter((record) => (options.referenceRecordKeys ?? []).includes(record.key));
  const availableReferenceChoices = referenceChoices.filter((record) => !(options.referenceRecordKeys ?? []).includes(record.key));
  const childTemplates = options.children ?? [];
  const groupValue = parseGroupValue(field.value);
  const groupListValue = parseGroupListValue(field.value);

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${isInherited ? 'inherited-field' : ''}`} style={{ borderColor: isInherited ? 'rgba(245,158,11,0.4)' : 'var(--border)', backgroundColor: 'rgba(255,255,255,0.62)' }}>
      {isInherited && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#b66a10' }}>
          <span>⚠</span>
          <span>継承済み — 内容を確認・更新してください</span>
          <button className="ml-auto transition-colors" style={{ color: 'var(--text-muted)' }} onClick={() => onChange({ ...field, inherited: 0 })}>✓ 確認済み</button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{field.label}</p>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {FIELD_TYPE_LABELS[field.type] || field.type}
            </span>
            {(field.type === 'reference' || field.type === 'reference_multi') && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                ・ {referenceObject?.name || '未設定'}
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          キー: {field.key}
        </div>
      </div>

      {field.type === 'group' && (
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          {childTemplates.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>このグループには子項目がありません。設定画面で追加してください。</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {childTemplates.map((childTemplate) => {
                const childField = buildChildField(childTemplate, groupValue[childTemplate.id] ?? groupValue[childTemplate.key], field.inherited);
                return (
                  <ChildFieldValueInput
                    key={childTemplate.id}
                    field={childField}
                    globalAssetObjects={globalAssetObjects}
                    onChange={(nextChild) => {
                      const nextValue = {
                        ...groupValue,
                        [childTemplate.id]: { value: nextChild.value, options: nextChild.options },
                      };
                      onChange({ ...field, value: JSON.stringify(nextValue) });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {field.type === 'group_list' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="field-label mb-0">グループ一覧</label>
            <button
              type="button"
              className="btn-secondary text-xs py-1 px-3"
              onClick={() => {
                const emptyItem = childTemplates.reduce<Record<string, GroupChildState>>((acc, childTemplate) => {
                  acc[childTemplate.id] = { value: '', options: childTemplate.options };
                  return acc;
                }, {});
                onChange({ ...field, value: JSON.stringify([...groupListValue, emptyItem]) });
              }}
            >
              + 追加
            </button>
          </div>
          {groupListValue.length === 0 ? (
            <div className="rounded-xl border px-3 py-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
              まだ項目はありません。必要なまとまりを追加してください。
            </div>
          ) : (
            groupListValue.map((item, itemIndex) => {
              const summary = childTemplates
                .slice(0, 2)
                .map((childTemplate) => (item[childTemplate.id] ?? item[childTemplate.key])?.value)
                .filter((value): value is string => Boolean(value))
                .join(' / ');
              return (
                <details key={`${field.id}-${itemIndex}`} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
                  <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{field.label} {itemIndex + 1}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{summary || '内容を入力してください'}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        const nextItems = groupListValue.filter((_, currentIndex) => currentIndex !== itemIndex);
                        onChange({ ...field, value: JSON.stringify(nextItems) });
                      }}
                    >
                      削除
                    </button>
                  </summary>
                  <div className="border-t p-4 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderColor: 'var(--border)' }}>
                    {childTemplates.map((childTemplate) => {
                      const childField = buildChildField(childTemplate, item[childTemplate.id] ?? item[childTemplate.key], field.inherited);
                      return (
                        <ChildFieldValueInput
                          key={childTemplate.id}
                          field={childField}
                          globalAssetObjects={globalAssetObjects}
                          onChange={(nextChild) => {
                            const nextItems = [...groupListValue];
                            nextItems[itemIndex] = {
                              ...nextItems[itemIndex],
                              [childTemplate.id]: { value: nextChild.value, options: nextChild.options },
                            };
                            onChange({ ...field, value: JSON.stringify(nextItems) });
                          }}
                        />
                      );
                    })}
                  </div>
                </details>
              );
            })
          )}
        </div>
      )}

      {field.type === 'reference' && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="field-label">参照レコード</label>
            <select
              className="field-input text-xs"
              value={options.referenceRecordKey || ''}
              onChange={(e) => {
                const record = referenceChoices.find((choice) => choice.key === e.target.value);
                onChange({
                  ...field,
                  value: record?.name || '',
                  options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKey: e.target.value }),
                });
              }}
            >
              <option value="">（選択してください）</option>
              {referenceChoices.map((record) => (
                <option key={record.id} value={record.key}>{record.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {field.type === 'reference_multi' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="field-label mb-0 shrink-0">参照レコードを追加</label>
            <select
              className="field-input text-xs"
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const nextKeys = [...(options.referenceRecordKeys ?? []), e.target.value];
                const nextRecords = referenceChoices.filter((record) => nextKeys.includes(record.key));
                onChange({
                  ...field,
                  value: nextRecords.map((record) => record.name).join(' / '),
                  options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKeys: nextKeys }),
                });
              }}
            >
              <option value="">（追加するレコードを選択）</option>
              {availableReferenceChoices.map((record) => (
                <option key={record.id} value={record.key}>{record.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="field-label">選択中の参照レコード</label>
            {selectedReferenceRecords.length === 0 ? (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ参照レコードは選択されていません。</div>
            ) : (
              selectedReferenceRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs bg-white/70" style={{ borderColor: 'var(--border)' }}>
                  <span>{record.name}</span>
                  <button
                    type="button"
                    className="transition-colors"
                    style={{ color: '#cc5c6d' }}
                    onClick={() => {
                      const nextKeys = (options.referenceRecordKeys ?? []).filter((key) => key !== record.key);
                      const nextRecords = referenceChoices.filter((choice) => nextKeys.includes(choice.key));
                      onChange({
                        ...field,
                        value: nextRecords.map((choice) => choice.name).join(' / '),
                        options: JSON.stringify({ referenceObjectId: options.referenceObjectId || '', referenceRecordKeys: nextKeys }),
                      });
                    }}
                  >
                    削除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {field.type !== 'reference' && field.type !== 'reference_multi' && field.type !== 'group' && field.type !== 'group_list' && (
        <div>
          {field.type === 'textarea' ? (
            <textarea className="field-input text-xs" rows={3} value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
          ) : field.type === 'select' ? (
            <select className="field-input text-xs" value={field.value} onChange={e => onChange({ ...field, value: e.target.value })}>
              <option value="">（選択してください）</option>
              {(options.choices ?? []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'url' ? (
            <div className="flex gap-2">
              <input className="field-input text-xs flex-1" type="url" value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} placeholder="https://" />
              <button onClick={onCrawl} disabled={crawling || !field.value} className="btn-secondary text-xs px-3 shrink-0">
                {crawling ? '取得中...' : 'クロール'}
              </button>
            </div>
          ) : (
            <input className="field-input text-xs" type={field.type === 'date' ? 'date' : 'text'} value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
          )}
          {field.crawled_content && (
            <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>✓ URL内容取得済み ({field.crawled_content.length} 文字)</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 生成アセット表示
// ============================================================
function AssetCard({
  asset,
  onDelete,
  onSaved,
}: {
  asset: GeneratedAsset;
  onDelete: () => void;
  onSaved: (nextAsset: GeneratedAsset) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(asset.title);
  const [draftContent, setDraftContent] = useState(asset.content);
  const [saving, setSaving] = useState(false);
  const warnings = (() => { try { return JSON.parse(asset.warnings) as string[]; } catch { return []; } })();

  useEffect(() => {
    setDraftTitle(asset.title);
    setDraftContent(asset.content);
  }, [asset.title, asset.content]);

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
              <div>
                <label className="field-label">タイトル</label>
                <input className="field-input text-sm" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
              </div>
              <div>
                <label className="field-label">内容</label>
                <textarea className="field-input text-sm" rows={18} value={draftContent} onChange={(e) => setDraftContent(e.target.value)} />
              </div>
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              {asset.content}
            </pre>
          )}
          <div className="flex gap-2 mt-4">
            {editing ? (
              <>
                <button onClick={() => { setDraftTitle(asset.title); setDraftContent(asset.content); setEditing(false); }} className="btn-secondary text-xs">キャンセル</button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary text-xs">{saving ? '保存中...' : '保存'}</button>
              </>
            ) : (
              <>
                <button onClick={copy} className="btn-secondary text-xs">{copied ? '✓ コピー済み' : 'コピー'}</button>
                <button onClick={() => setEditing(true)} className="btn-secondary text-xs">編集</button>
              </>
            )}
            <button onClick={onDelete} className="btn-danger">削除</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [project, setProject] = useState<ProjectWithFields | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeDefinition[]>([]);
  const [globalAssetObjects, setGlobalAssetObjects] = useState<GlobalAssetObject[]>([]);
  const [contentTemplates, setContentTemplates] = useState<ProjectContentTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
  const [selectedContentKeys, setSelectedContentKeys] = useState<AssetType[]>([]);
  const [additionalGenerationInstruction, setAdditionalGenerationInstruction] = useState('');
  const [crawlingFieldId, setCrawlingFieldId] = useState<string | null>(null);
  const [tab, setTab] = useState<'fields' | 'assets'>('fields');
  const [loadError, setLoadError] = useState<string>('');
  const [aiError, setAiError] = useState('');

  const loadProject = useCallback(async () => {
    setLoadError('');
    const [projectRes, assetsRes] = await Promise.all([
      fetch(withBasePath(`/api/projects/${id}`)),
      fetch(withBasePath(`/api/projects/${id}/assets`)),
    ]);
    const [projectTypesRes, globalAssetsRes, contentTemplatesRes] = await Promise.all([
      fetch(withBasePath('/api/project-types')),
      fetch(withBasePath('/api/global-assets')),
      fetch(withBasePath('/api/content-templates')),
    ]);
    const [pr, ar, projectTypesPayload, globalAssetsPayload, contentTemplatesPayload] = await Promise.all([
      projectRes.json(),
      assetsRes.json(),
      projectTypesRes.json(),
      globalAssetsRes.json(),
      contentTemplatesRes.json(),
    ]);

    if (projectRes.status === 401) {
      setProject(null);
      setAssets([]);
      router.push(withBasePath('/login'));
      return;
    }

    if (projectRes.status === 404 || assetsRes.status === 404) {
      setProject(null);
      setAssets([]);
      setLoadError('このプロジェクトは見つからないか、アクセスできません。');
      return;
    }

    if (!projectRes.ok || !assetsRes.ok) {
      setProject(null);
      setAssets([]);
      setLoadError('プロジェクトの読み込みに失敗しました。');
      return;
    }

    setProject(normalizeProject(pr as ProjectWithFields));
    setAssets(Array.isArray(ar) ? ar as GeneratedAsset[] : []);
    setProjectTypes(Array.isArray(projectTypesPayload.project_types) ? projectTypesPayload.project_types as ProjectTypeDefinition[] : []);
    setGlobalAssetObjects(Array.isArray(globalAssetsPayload.objects) ? globalAssetsPayload.objects as GlobalAssetObject[] : []);
    setContentTemplates(Array.isArray(contentTemplatesPayload.content_templates) ? contentTemplatesPayload.content_templates as ProjectContentTemplate[] : []);
  }, [id, router]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const resolvedUser = user ?? await checkSession();
      if (!resolvedUser) {
        setProject(null);
        setAssets([]);
        router.push(withBasePath('/login'));
        return;
      }
      loadProject();
    })();
  }, [authLoading, user, loadProject, router, checkSession]);

  useEffect(() => {
    const currentType = projectTypes.find((definition) => definition.key === project?.type);
    const availableKeys = contentTemplates
      .filter((template) => currentType?.content_template_ids.includes(template.id))
      .map((template) => template.key);
    setSelectedContentKeys((current) => {
      const filtered = current.filter((key) => availableKeys.includes(key));
      if (filtered.length > 0) return filtered;
      return availableKeys.slice(0, Math.min(availableKeys.length, 2));
    });
  }, [project?.type, projectTypes, contentTemplates]);

  async function save(p: ProjectWithFields) {
    setSaving(true);
    const channels = (() => { try { return JSON.parse(p.channels) as string[]; } catch { return []; } })();
    await fetch(withBasePath(`/api/projects/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, channels, custom_fields: p.custom_fields }),
    });
    setSaving(false);
    setSavingMsg('保存済み');
    setTimeout(() => setSavingMsg(''), 2000);
  }

  function updateField(idx: number, f: CustomField) {
    if (!project) return;
    const fields = [...project.custom_fields];
    fields[idx] = f;
    setProject({ ...project, custom_fields: fields });
  }

  async function crawlField(fieldId: string) {
    setCrawlingFieldId(fieldId);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/crawl`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field_id: fieldId }) });
      if (res.ok) await loadProject();
    } finally {
      setCrawlingFieldId(null);
    }
  }

  async function generate() {
    if (!project || selectedContentKeys.length === 0) return;
    setAiError('');
    await save(project);
    setGenerating(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/generate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_types: selectedContentKeys, additional_instruction: additionalGenerationInstruction }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setAiError(payload.error || 'AI生成に失敗しました。');
        return;
      }
      await loadProject();
      setTab('assets');
    } finally {
      setGenerating(false);
    }
  }

  async function complete() {
    if (!project) return;
    setAiError('');
    await save(project);
    setCompleting(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/complete`), { method: 'POST' });
      const data = await res.json() as { suggestions: CompletionSuggestion[]; error?: string };
      if (!res.ok) {
        setAiError(data.error || 'AI補完に失敗しました。');
        return;
      }
      setSuggestions(data.suggestions ?? []);
    } finally {
      setCompleting(false);
    }
  }

  function applySuggestion(s: CompletionSuggestion) {
    if (!project) return;
    const fields = project.custom_fields.map(f => f.id === s.field_id ? { ...f, value: s.suggested_value } : f);
    setProject({ ...project, custom_fields: fields });
    setSuggestions(sug => sug.filter(ss => ss.field_id !== s.field_id));
  }

  async function deleteAsset(assetId: string) {
    await fetch(withBasePath(`/api/projects/${id}/assets?assetId=${assetId}`), { method: 'DELETE' });
    setAssets(a => a.filter(x => x.id !== assetId));
  }

  function updateAsset(updatedAsset: GeneratedAsset) {
    setAssets((current) => current.map((asset) => asset.id === updatedAsset.id ? updatedAsset : asset));
  }

  async function deleteProject() {
    if (!confirm('このプロジェクトを削除しますか？')) return;
    await fetch(withBasePath(`/api/projects/${id}`), { method: 'DELETE' });
    router.push(withBasePath('/'));
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
      <p>読み込み中...</p>
    </div>
  );

  if (!project) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
      <p>{loadError || '読み込み中...'}</p>
    </div>
  );

  const channels = (() => { try { return JSON.parse(project.channels) as string[]; } catch { return []; } })();
  const customFields = Array.isArray(project.custom_fields) ? project.custom_fields : [];
  const inheritedCount = customFields.filter(f => f.inherited === 1).length;
  const currentProjectType = projectTypes.find((definition) => definition.key === project.type);
  const currentContentTemplates = contentTemplates.filter((template) => currentProjectType?.content_template_ids.includes(template.id));
  const typeLabel = currentProjectType?.name || PROJECT_TYPE_LABELS[project.type as ProjectType] || project.type;
  const currentPhases = currentProjectType?.phases || [];
  const currentPhaseIndex = currentPhases.findIndex((phase) => phase.key === project.phase_key);

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="px-6 py-5 border-b space-y-4" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(241,250,252,0.92) 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <button onClick={() => router.push(withBasePath('/'))} className="text-sm w-fit transition-colors" style={{ color: 'var(--text-muted)' }}>← 戻る</button>
          <div className="flex-1 min-w-0">
            <input
              className="bg-transparent text-xl font-bold w-full focus:outline-none border-b border-transparent transition-colors"
              style={{ color: 'var(--text-primary)' }}
              value={project.name}
              onChange={e => setProject({ ...project, name: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{typeLabel}</span>
              {project.cloned_from && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>• クローン</span>}
              {inheritedCount > 0 && <span className="text-xs" style={{ color: '#b66a10' }}>• 要確認フィールド {inheritedCount}件</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {savingMsg && <span className="text-xs" style={{ color: 'var(--success)' }}>{savingMsg}</span>}
            <select className="field-input text-xs w-auto" value={project.status} onChange={e => setProject({ ...project, status: e.target.value as typeof project.status })}>
              <option value="draft">下書き</option>
              <option value="active">実施中</option>
              <option value="archived">アーカイブ</option>
            </select>
            <button onClick={() => save(project)} disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={deleteProject} className="btn-danger text-xs">削除</button>
          </div>
        </div>

        {currentPhases.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>進行パス</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  全体の流れと現在地を表示しています。クリックで現在フェーズを切り替えられます。
                </p>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                現在地: {currentPhases[currentPhaseIndex]?.name || '未設定'}
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-stretch">
              {currentPhases.map((phase, phaseIndex) => {
                const isCurrent = phase.key === project.phase_key;
                const isCompleted = currentPhaseIndex >= 0 && phaseIndex < currentPhaseIndex;
                const isUpcoming = !isCurrent && !isCompleted;
                const isLast = phaseIndex === currentPhases.length - 1;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setProject({ ...project, phase_key: phase.key })}
                    className="relative flex min-w-[140px] items-center justify-between px-4 py-3 text-sm font-medium transition-colors border-y border-l first:rounded-l-2xl last:rounded-r-2xl"
                    style={{
                      marginRight: isLast ? 0 : 18,
                      borderColor: isCurrent ? 'rgba(15,154,177,0.42)' : isCompleted ? 'rgba(31,157,114,0.34)' : 'var(--border)',
                      borderRightColor: isLast ? (isCurrent ? 'rgba(15,154,177,0.42)' : isCompleted ? 'rgba(31,157,114,0.34)' : 'var(--border)') : 'transparent',
                      background: isCurrent
                        ? 'linear-gradient(135deg, rgba(15,154,177,0.2) 0%, rgba(126,215,222,0.34) 100%)'
                        : isCompleted
                          ? 'linear-gradient(135deg, rgba(31,157,114,0.16) 0%, rgba(183,244,216,0.6) 100%)'
                          : 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(241,250,252,0.86) 100%)',
                      color: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--success)' : 'var(--text-secondary)',
                      boxShadow: isCurrent ? '0 10px 24px rgba(15,154,177,0.14)' : 'none',
                    }}
                  >
                    {!isLast && (
                      <>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[-1px] right-[-19px] z-20 h-[calc(100%+2px)] w-5"
                          style={{
                            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                            background: isCurrent
                              ? 'linear-gradient(135deg, rgba(15,154,177,0.2) 0%, rgba(126,215,222,0.34) 100%)'
                              : isCompleted
                                ? 'linear-gradient(135deg, rgba(31,157,114,0.16) 0%, rgba(183,244,216,0.6) 100%)'
                                : 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(241,250,252,0.86) 100%)',
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[-1px] right-[-20px] h-[calc(100%+2px)] w-5"
                          style={{
                            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                            background: isCurrent ? 'rgba(15,154,177,0.42)' : isCompleted ? 'rgba(31,157,114,0.34)' : 'var(--border)',
                            zIndex: 10,
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[1px] right-[-16px] z-30 h-[calc(100%-2px)] w-4"
                          style={{
                            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                            background: 'var(--bg-base)',
                          }}
                        />
                      </>
                    )}
                    <span className="relative z-40 flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: isCurrent ? 'rgba(255,255,255,0.78)' : isCompleted ? 'rgba(255,255,255,0.72)' : 'rgba(237,245,248,0.95)',
                          color: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--success)' : 'var(--text-muted)',
                        }}
                      >
                        {phaseIndex + 1}
                      </span>
                      <span>{phase.name}</span>
                    </span>
                    <span className="relative z-40 text-xs" style={{ color: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--success)' : 'var(--text-muted)' }}>
                      {isCurrent ? 'Now' : isCompleted ? 'Done' : isUpcoming ? 'Next' : ''}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        )}
        {currentPhases.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            この種別にはまだフェーズ定義がありません。プロジェクト種別設定で追加してください。
          </div>
        )}
      </div>
      
      {/* 本体 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左: フィールド編集 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* タブ切り替え */}
          <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            {[{ k: 'fields' as const, l: 'プロジェクト情報' }, { k: 'assets' as const, l: `生成コンテンツ (${assets.length})` }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`text-sm px-3 py-1.5 rounded-xl transition-colors ${tab === t.k ? '' : ''}`}
                style={tab === t.k
                  ? { backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.18)' }
                  : { color: 'var(--text-muted)' }}
              >
                {t.l}
              </button>
            ))}
          </div>

          {tab === 'fields' ? (
            <>
              {/* コアフィールド */}
              <section>
                <h2 className="section-title mb-3">基本情報 (Project Core)</h2>
                <div className="card p-5 grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>種別: <span style={{ color: 'var(--accent)' }}>{typeLabel}</span></span>
                    <span>現在フェーズ: <span style={{ color: 'var(--accent)' }}>{currentPhases[currentPhaseIndex]?.name || '未設定'}</span></span>
                    <span>総フェーズ数: {currentPhases.length}</span>
                  </div>
                  <div>
                    <label className="field-label">種別</label>
                    <select
                      className="field-input"
                      value={project.type}
                      onChange={e => {
                        const nextType = e.target.value as typeof project.type;
                        const nextDefinition = projectTypes.find((definition) => definition.key === nextType);
                        const nextPhaseKey = nextDefinition?.phases.find((phase) => phase.key === project.phase_key)
                          ? project.phase_key
                          : (nextDefinition?.phases[0]?.key || '');
                        setProject({ ...project, type: nextType, phase_key: nextPhaseKey });
                      }}
                    >
                      {projectTypes.map((definition) => <option key={definition.id} value={definition.key}>{definition.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">ターゲット</label>
                    <input className="field-input" value={project.target} onChange={e => setProject({ ...project, target: e.target.value })} placeholder="例: 30代 BtoB マーケター" />
                  </div>
                  <div>
                    <label className="field-label">開始日</label>
                    <input className="field-input" type="date" value={project.start_date} onChange={e => setProject({ ...project, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">終了日</label>
                    <input className="field-input" type="date" value={project.end_date} onChange={e => setProject({ ...project, end_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">予算</label>
                    <input className="field-input" value={project.budget} onChange={e => setProject({ ...project, budget: e.target.value })} placeholder="例: ¥500,000" />
                  </div>
                  <div>
                    <label className="field-label">チャネル（カンマ区切り）</label>
                    <input className="field-input" value={channels.join(', ')} onChange={e => setProject({ ...project, channels: JSON.stringify(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) })} placeholder="Web, SNS, メール" />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">概要</label>
                    <textarea className="field-input" rows={3} value={project.description} onChange={e => setProject({ ...project, description: e.target.value })} placeholder="施策の目的・背景・概要を記述" />
                  </div>
                </div>
              </section>

              {/* フィールド */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-title">フィールド</h2>
                </div>
                {customFields.length === 0 ? (
                  <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm">このプロジェクト種別には追加フィールドがありません</p>
                    <p className="text-xs mt-1">フィールド定義の追加や変更はプロジェクト設定から行ってください</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {customFields.map((f, i) => (
                      <div key={f.id} className={f.layout === 'full' ? 'xl:col-span-2' : ''}>
                        <CustomFieldRow
                          field={f}
                          globalAssetObjects={globalAssetObjects}
                          onChange={nf => updateField(i, nf)}
                          onCrawl={() => crawlField(f.id)}
                          crawling={crawlingFieldId === f.id}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* AI補完サジェスト */}
              {suggestions.length > 0 && (
                <section>
                  <h2 className="section-title mb-3">AI補完サジェスト</h2>
                  <div className="space-y-2">
                    {suggestions.map(s => (
                      <div key={s.field_id} className="card p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{s.label}</p>
                          <p className="text-sm mt-1">{s.suggested_value}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.reason}</p>
                        </div>
                        <button onClick={() => applySuggestion(s)} className="btn-primary text-xs shrink-0">適用</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section>
              {assets.length === 0 ? (
                <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <p>まだコンテンツは生成されていません</p>
                  <p className="text-xs mt-1">右パネルから生成対象を選んで実行してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assets.map(a => <AssetCard key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} onSaved={updateAsset} />)}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 右: AI生成パネル */}
        <div className="w-80 shrink-0 border-l overflow-y-auto p-5 space-y-5" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(241,250,252,0.9) 100%)' }}>
          <h2 className="section-title">コンテンツ生成</h2>

          {/* 生成コンテンツ選択 */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>生成するコンテンツ</p>
            <div className="space-y-1.5">
              {currentContentTemplates.map((template) => (
                <label key={template.id} className="flex items-center gap-2.5 cursor-pointer group rounded-xl px-3 py-2 transition-colors bg-white/60 border" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={selectedContentKeys.includes(template.key)}
                    onChange={e => setSelectedContentKeys(prev => e.target.checked ? [...prev, template.key] : prev.filter(t => t !== template.key))}
                    className="accent-cyan-600"
                  />
                  <span className="text-sm transition-colors" style={{ color: selectedContentKeys.includes(template.key) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{template.name}</span>
                </label>
              ))}
              {currentContentTemplates.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  このプロジェクト種別には生成コンテンツ定義がありません。設定から追加してください。
                </div>
              )}
            </div>
          </div>

          {/* 生成ボタン */}
          <button
            onClick={generate}
            disabled={generating || selectedContentKeys.length === 0}
            className="btn-primary w-full justify-center py-2.5"
          >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-cyan-100 border-t-transparent rounded-full animate-spin" />
                  生成中...
                </span>
              ) : `選択中の ${selectedContentKeys.length} 件を生成`}
          </button>

          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>追加指示（任意）</p>
            <textarea
              className="field-input text-xs"
              rows={4}
              value={additionalGenerationInstruction}
              onChange={(e) => setAdditionalGenerationInstruction(e.target.value)}
              placeholder="今回だけ反映したい条件や補足があれば入力"
            />
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>フィールド自動補完</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>既存の情報を元に、未入力フィールドの値をAIが推測します</p>
            <button onClick={complete} disabled={completing} className="btn-secondary w-full justify-center text-sm">
              {completing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                  分析中...
                </span>
              ) : 'AI補完を実行'}
            </button>
          </div>

          {aiError && (
            <div className="p-3 rounded-xl border" style={{ borderColor: 'rgba(222,91,91,0.24)', backgroundColor: 'rgba(255,243,243,0.9)', color: '#b34a4a' }}>
              <p className="text-xs font-semibold">AI実行エラー</p>
              <p className="text-xs mt-1">{aiError}</p>
              <button onClick={() => router.push(withBasePath('/settings/ai'))} className="text-xs mt-2 transition-colors" style={{ color: 'var(--accent)' }}>
                AI設定を開く →
              </button>
            </div>
          )}

          {/* 参照情報サマリー */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mb-2 section-title">AIへの参照スコープ</p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
              <li className="flex items-center gap-1.5"><span style={{ color: 'var(--success)' }}>✓</span> Global Assets</li>
              <li className="flex items-center gap-1.5"><span style={{ color: 'var(--success)' }}>✓</span> プロジェクトコア情報</li>
              <li className="flex items-center gap-1.5"><span style={{ color: project.custom_fields.length > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {project.custom_fields.length > 0 ? '✓' : '−'}
              </span> フィールド ({project.custom_fields.length}件)</li>
              <li className="flex items-center gap-1.5"><span style={{ color: project.custom_fields.some(f => f.crawled_content) ? 'var(--success)' : 'var(--text-muted)' }}>
                {project.custom_fields.some(f => f.crawled_content) ? '✓' : '−'}
              </span> クロール済みURL</li>
            </ul>
          </div>

          {inheritedCount > 0 && (
            <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 243, 224, 0.8)', borderColor: 'rgba(215,138,29,0.25)' }}>
              <p className="text-xs font-semibold" style={{ color: '#b66a10' }}>⚠ 継承フィールドあり</p>
              <p className="text-xs mt-1" style={{ color: '#9a6213' }}>{inheritedCount}件のフィールドが前回施策から継承されています。生成前に確認を推奨します。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
