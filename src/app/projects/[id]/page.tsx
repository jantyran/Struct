'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ProjectWithFields, CustomField, GeneratedAsset, AssetType, FieldType, CompletionSuggestion, ProjectTypeDefinition, GlobalAssetObject, ProjectType, ProjectContentTemplate, ProjectFieldTemplate, ProjectPhase, ProjectNote, Todo } from '@/types';
import { FIELD_TYPE_LABELS, PROJECT_TYPE_LABELS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { useDevSettings } from '@/components/DevSettingsContext';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import TodoTab from '@/components/TodoTab';
import { MarkdownRichTextEditor, MarkdownViewer } from '@/components/MarkdownRichTextEditor';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';

type ProjectDetailTabKey = 'fields' | 'assets' | 'notes' | 'members' | 'tasks';

function normalizeProject(project: ProjectWithFields): ProjectWithFields {
  return {
    ...project,
    custom_fields: Array.isArray(project?.custom_fields) ? project.custom_fields : [],
    members: Array.isArray(project?.members) ? project.members : [],
    invitations: Array.isArray(project?.invitations) ? project.invitations : [],
  };
}

function PencilIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5 13.5 4.5 5.5 12.5 2.5 13.5 3.5 10.5Z" />
    </svg>
  );
}

function OpenLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5 7.5 8.5" />
      <path d="M6.5 3.5h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

function parseUrlFieldValue(raw: string): { label: string; url: string } {
  if (!raw) return { label: '', url: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'url' in parsed) {
      return { label: String(parsed.label ?? ''), url: String(parsed.url ?? '') };
    }
  } catch { /* not JSON → treat as plain URL */ }
  return { label: '', url: raw };
}

function serializeUrlFieldValue(label: string, url: string): string {
  if (!label.trim()) return url;
  return JSON.stringify({ label: label.trim(), url });
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

function userDisplayName(user: { email: string; name?: string | null }) {
  return user.name?.trim() || user.email;
}

function userInitials(user: { email: string; name?: string | null }) {
  return userDisplayName(user).slice(0, 2).toUpperCase();
}

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
    is_builtin: childTemplate.is_builtin ? 1 : 0,
    section: childTemplate.section ?? '',
  };
}

// ============================================================
// 参照レコード詳細モーダル
// ============================================================
function RecordDetailModal({
  record,
  object,
  onClose,
}: {
  record: GlobalAssetObject['records'][number];
  object: GlobalAssetObject | undefined;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="card w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-medium" style={{ color: 'var(--text-muted)' }}>{object?.name}</p>
            <h2 className="text-lg font-bold mt-0.5">{record.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >✕</button>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {(object?.fields ?? []).map((f) => {
            const value = record.values?.[f.key] ?? '';
            if (!value) return null;
            return (
              <div key={f.key} className="py-3 first:pt-0">
                <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
                {f.type === 'url' ? (
                  <a href={value} target="_blank" rel="noopener noreferrer"
                    className="text-sm break-all underline" style={{ color: 'var(--accent)' }}>
                    {value}
                  </a>
                ) : f.type === 'textarea' ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
                ) : (
                  <p className="text-sm">{value}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UrlFieldInput({
  value,
  onChange,
  onCrawl,
  crawling,
}: {
  value: string;
  onChange: (v: string) => void;
  onCrawl?: () => void;
  crawling?: boolean;
}) {
  const parsed = parseUrlFieldValue(value);
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(parsed.label);
  const [draftUrl, setDraftUrl] = useState(parsed.url);

  useEffect(() => {
    const { label, url } = parseUrlFieldValue(value);
    setDraftLabel(label);
    setDraftUrl(url);
  }, [value]);

  function handleDone() {
    onChange(serializeUrlFieldValue(draftLabel, draftUrl));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          className="field-input text-xs w-full"
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="リンク名（任意）"
        />
        <div className="flex gap-2">
          <input
            className="field-input text-xs flex-1"
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://"
            autoFocus={!draftLabel}
          />
          {draftUrl && (
            <a
              href={draftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs px-2.5 shrink-0 flex items-center justify-center"
              title="リンクを開く"
              aria-label="リンクを開く"
            >
              <OpenLinkIcon size={11} />
            </a>
          )}
          {onCrawl && (
            <button type="button" onClick={onCrawl} disabled={crawling || !draftUrl} className="btn-secondary text-xs px-3 shrink-0">
              {crawling ? '取得中...' : 'クロール'}
            </button>
          )}
        </div>
        <button type="button" onClick={handleDone} className="btn-secondary text-xs px-3 py-1">完了</button>
      </div>
    );
  }

  const { label, url } = parsed;
  const hasUrl = url.trim().length > 0;
  const hasLabel = label.trim().length > 0;

  return (
    <div className="flex items-center gap-2 min-w-0">
      {hasUrl ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline truncate"
          style={{ color: 'var(--accent)' }}
        >
          {hasLabel ? label : url}
        </a>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>（未入力）</span>
      )}
      {hasUrl && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center px-1 py-0.5 rounded transition-colors hover:opacity-70"
          style={{ color: 'var(--accent)' }}
          title="リンクを開く"
          aria-label="リンクを開く"
        >
          <OpenLinkIcon size={11} />
        </a>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 flex items-center px-1 py-0.5 rounded transition-colors hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
        title="編集"
      >
        <PencilIcon />
      </button>
    </div>
  );
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
  const [viewingRecord, setViewingRecord] = useState<GlobalAssetObject['records'][number] | null>(null);

  if (field.type === 'url') {
    return (
      <div className={field.layout === 'full' ? 'md:col-span-2' : ''}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{field.label}</span>
          <UrlFieldInput value={field.value} onChange={(v) => onChange({ ...field, value: v })} />
        </div>
      </div>
    );
  }

  return (
    <div className={field.layout === 'full' ? 'md:col-span-2' : ''}>
      {viewingRecord && referenceObject && (
        <RecordDetailModal record={viewingRecord} object={referenceObject} onClose={() => setViewingRecord(null)} />
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{field.label}</p>
          <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
            {FIELD_TYPE_LABELS[field.type] || field.type}
          </span>
          {(field.type === 'reference' || field.type === 'reference_multi') && (
            <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
              ・ {referenceObject?.name || '未設定'}
            </span>
          )}
        </div>

        {field.type === 'reference' && (
          <div className="flex gap-2 items-center">
            <select
              className="field-input text-xs flex-1"
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
            {options.referenceRecordKey && referenceObject && (
              <button
                type="button"
                className="btn-secondary text-xs px-2.5 py-1 shrink-0"
                onClick={() => setViewingRecord(referenceChoices.find(r => r.key === options.referenceRecordKey) ?? null)}
              >詳細</button>
            )}
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
              {selectedReferenceRecords.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ参照レコードは選択されていません。</div>
              ) : (
                selectedReferenceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs bg-white/70" style={{ borderColor: 'var(--border)' }}>
                    <span>{record.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="transition-colors"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => setViewingRecord(record)}
                      >詳細</button>
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
                      >削除</button>
                    </div>
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
          ) : field.type === 'number' ? (
            <input
              className="field-input text-xs"
              type="number"
              value={field.value}
              onChange={(e) => onChange({ ...field, value: e.target.value })}
            />
          ) : (
            <input
              className="field-input text-xs"
              type={field.type === 'date' ? 'date' : 'text'}
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
function CustomFieldRow({ field, globalAssetObjects, onChange, onCrawl, crawling, showFieldKeys, showFieldTypes, showFieldIds, showFieldListBorders }: {
  field: CustomField;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (f: CustomField) => void;
  onCrawl: () => void;
  crawling: boolean;
  showFieldKeys: boolean;
  showFieldTypes: boolean;
  showFieldIds: boolean;
  showFieldListBorders: boolean;
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
  const [viewingRecord, setViewingRecord] = useState<GlobalAssetObject['records'][number] | null>(null);

  function addRepeatingItem() {
    if (field.type === 'list') {
      const t = childTemplates[0];
      const emptyItem = t ? { [t.id]: { value: '', options: t.options } } : {};
      onChange({ ...field, value: JSON.stringify([...groupListValue, emptyItem]) });
    } else if (field.type === 'group_list') {
      const emptyItem = childTemplates.reduce<Record<string, GroupChildState>>((acc, t) => {
        acc[t.id] = { value: '', options: t.options };
        return acc;
      }, {});
      onChange({ ...field, value: JSON.stringify([...groupListValue, emptyItem]) });
    }
  }

  const cardStyle = showFieldListBorders
    ? { borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }
    : { borderColor: 'transparent', backgroundColor: 'transparent' };
  const listDividerColor = showFieldListBorders ? 'var(--border)' : 'transparent';
  const detailCardBodyStyle = showFieldListBorders
    ? { borderColor: listDividerColor, backgroundColor: 'rgba(248,252,255,0.6)' }
    : { borderColor: listDividerColor, backgroundColor: 'transparent' };

  return (
    <div className={`field-section-card ${isInherited ? 'inherited-field' : ''}`}>
      {viewingRecord && (
        <RecordDetailModal record={viewingRecord} object={referenceObject} onClose={() => setViewingRecord(null)} />
      )}
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
            {showFieldTypes && (
              <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                {FIELD_TYPE_LABELS[field.type] || field.type}
              </span>
            )}
            {showFieldTypes && (field.type === 'reference' || field.type === 'reference_multi') && (
              <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                ・ {referenceObject?.name || '未設定'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(showFieldKeys || showFieldIds) && (
            <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
              {showFieldKeys && <span>キー: {field.key}</span>}
              {showFieldIds && <span>ID: {field.id}</span>}
            </div>
          )}
          {(field.type === 'list' || field.type === 'group_list') && (
            <button type="button" className="btn-secondary text-xs py-0.5 px-2.5" onClick={addRepeatingItem}>+ 追加</button>
          )}
        </div>
      </div>

      {field.type === 'group' && (
        <div className="rounded-xl border p-3 space-y-3" style={cardStyle}>
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

      {field.type === 'list' && (() => {
        const singleTemplate = childTemplates[0];
        function deleteListItem(idx: number) {
          onChange({ ...field, value: JSON.stringify(groupListValue.filter((_, i) => i !== idx)) });
        }
        return groupListValue.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ項目はありません。</p>
        ) : (
          <div className={showFieldListBorders ? 'rounded-xl border p-1.5' : ''} style={showFieldListBorders ? cardStyle : undefined}>
            <div className="space-y-1.5">
              {groupListValue.map((item, itemIndex) => {
                if (!singleTemplate) return null;
                const childField = buildChildField(singleTemplate, item[singleTemplate.id] ?? item[singleTemplate.key], field.inherited);
                function updateListValue(v: string) {
                  const nextItems = [...groupListValue];
                  nextItems[itemIndex] = { ...nextItems[itemIndex], [singleTemplate.id]: { value: v, options: singleTemplate.options } };
                  onChange({ ...field, value: JSON.stringify(nextItems) });
                }
                return (
                  <div
                    key={`${field.id}-${itemIndex}`}
                    className="flex items-center gap-1.5 rounded-lg px-0.5 py-0.5"
                    style={{ backgroundColor: showFieldListBorders ? 'rgba(255,255,255,0.38)' : 'transparent' }}
                  >
                    <div className="flex-1 min-w-0">
                      {singleTemplate.type === 'url' ? (
                        <UrlFieldInput value={childField.value} onChange={updateListValue} />
                      ) : singleTemplate.type === 'select' ? (
                        <select className="field-input text-xs w-full" value={childField.value} onChange={(e) => updateListValue(e.target.value)}>
                          <option value="">（選択）</option>
                          {(parseFieldOptions(singleTemplate.options).choices ?? []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input text-xs w-full"
                          type={singleTemplate.type === 'date' ? 'date' : singleTemplate.type === 'number' ? 'number' : 'text'}
                          value={childField.value}
                          onChange={(e) => updateListValue(e.target.value)}
                          placeholder={singleTemplate.label || '値を入力'}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-1 py-0.5 text-[0.625rem] leading-none transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-muted)', backgroundColor: 'rgba(111,135,148,0.06)' }}
                      onClick={() => deleteListItem(itemIndex)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {field.type === 'group_list' && (() => {
        function deleteGroupItem(idx: number) {
          onChange({ ...field, value: JSON.stringify(groupListValue.filter((_, i) => i !== idx)) });
        }
        return groupListValue.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ項目はありません。</p>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            {groupListValue.map((item, itemIndex) => {
              const summaryParts = childTemplates
                .slice(0, 3)
                .map((t) => {
                  const raw = (item[t.id] ?? item[t.key])?.value;
                  if (!raw) return null;
                  if (t.type === 'url') { const { label } = parseUrlFieldValue(raw); return label || null; }
                  return raw;
                })
                .filter((v): v is string => Boolean(v));
              return (
                <details key={`${field.id}-${itemIndex}`} className="border-b last:border-b-0" style={{ borderColor: listDividerColor }}>
                  <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2.5 hover:bg-[rgba(15,154,177,0.03)]">
                    <span className="flex-1 text-xs truncate min-w-0" style={{ color: summaryParts.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {summaryParts.length > 0 ? summaryParts.join(' · ') : '（未入力）'}
                    </span>
                    <button type="button" className="shrink-0 text-[0.625rem] px-1.5 py-0.5 rounded transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}
                      onClick={(e) => { e.preventDefault(); deleteGroupItem(itemIndex); }}>✕</button>
                    <span className="shrink-0 text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>▾</span>
                  </summary>
                  <div className="border-t px-3 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-3" style={detailCardBodyStyle}>
                    {childTemplates.map((childTemplate) => {
                      const childField = buildChildField(childTemplate, item[childTemplate.id] ?? item[childTemplate.key], field.inherited);
                      return (
                        <ChildFieldValueInput key={childTemplate.id} field={childField} globalAssetObjects={globalAssetObjects}
                          onChange={(nextChild) => {
                            const nextItems = [...groupListValue];
                            nextItems[itemIndex] = { ...nextItems[itemIndex], [childTemplate.id]: { value: nextChild.value, options: nextChild.options } };
                            onChange({ ...field, value: JSON.stringify(nextItems) });
                          }} />
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        );
      })()}

      {field.type === 'reference' && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="field-label">参照レコード</label>
            <div className="flex gap-2 items-center">
              <select
                className="field-input text-xs flex-1"
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
              {options.referenceRecordKey && (() => {
                const rec = referenceChoices.find((r) => r.key === options.referenceRecordKey);
                return rec ? (
                  <button type="button" className="btn-secondary text-xs px-2 shrink-0" onClick={() => setViewingRecord(rec)}>詳細</button>
                ) : null;
              })()}
            </div>
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
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn-secondary text-xs px-2" onClick={() => setViewingRecord(record)}>詳細</button>
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
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {field.type !== 'reference' && field.type !== 'reference_multi' && field.type !== 'group' && field.type !== 'group_list' && field.type !== 'list' && (
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
            <UrlFieldInput
              value={field.value}
              onChange={(v) => onChange({ ...field, value: v })}
              onCrawl={onCrawl}
              crawling={crawling}
            />
          ) : field.type === 'number' ? (
            <input className="field-input text-xs" type="number" value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
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
// ノートピッカーボタン
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
// 生成アセット表示
// ============================================================
function AssetCard({
  asset,
  onDelete,
  onSaved,
  onDirtyChange,
}: {
  asset: GeneratedAsset;
  onDelete: () => void;
  onSaved: (nextAsset: GeneratedAsset) => void;
  onDirtyChange?: (assetId: string, dirty: boolean) => void;
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
            <div className="flex gap-2 mt-4">
              <button onClick={copy} className="btn-secondary text-xs">{copied ? '✓ コピー済み' : 'コピー'}</button>
              <button onClick={() => setEditing(true)} className="btn-secondary text-xs">編集</button>
              <button onClick={onDelete} className="btn-danger">削除</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// セクション内情報ウィジェット（project_type / phase）
// CustomFieldRow と同じカードスタイル: ラベル（field-label）+ 値テキスト
// ============================================================
function SectionInfoWidget({
  kind,
  layout,
  project,
  projectType,
  phases,
  typeLabel,
  notes,
  todos,
  todosLoading,
  members,
  onNotesTabClick,
  onTasksTabClick,
}: {
  kind: string;
  layout: 'half' | 'full';
  project: ProjectWithFields;
  projectType: ProjectTypeDefinition | undefined;
  phases: ProjectPhase[];
  typeLabel: string;
  notes?: ProjectNote[];
  todos?: import('@/types').Todo[];
  todosLoading?: boolean;
  members?: import('@/types').ProjectUser[];
  onNotesTabClick?: () => void;
  onTasksTabClick?: () => void;
}) {
  const colClass = layout === 'full' ? 'col-span-2' : '';

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
          <div className="flex flex-wrap gap-1.5">
            {memberList.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                {m.name?.trim() || m.email}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ============================================================
// メインページ
// ============================================================
export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const { settings: devSettings } = useDevSettings();
  const [project, setProject] = useState<ProjectWithFields | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeDefinition[]>([]);
  const [globalAssetObjects, setGlobalAssetObjects] = useState<GlobalAssetObject[]>([]);
  const [contentTemplates, setContentTemplates] = useState<ProjectContentTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
  const [completionMessage, setCompletionMessage] = useState('');
  const [completionRawSnippet, setCompletionRawSnippet] = useState('');
  const [completionAdditionalInstruction, setCompletionAdditionalInstruction] = useState('');
  const [completionSelectedNoteIds, setCompletionSelectedNoteIds] = useState<Set<string>>(new Set());
  const [generateSelectedNoteIds, setGenerateSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectedContentKeys, setSelectedContentKeys] = useState<AssetType[]>([]);
  const [additionalGenerationInstruction, setAdditionalGenerationInstruction] = useState('');
  const [crawlingFieldId, setCrawlingFieldId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab: ProjectDetailTabKey =
    requestedTab === 'todos'
      ? 'tasks'
      : requestedTab === 'fields' || requestedTab === 'tasks' || requestedTab === 'members' || requestedTab === 'notes' || requestedTab === 'assets'
        ? requestedTab
        : user?.settings?.default_project_tab || 'fields';
  const [primaryTab, setPrimaryTab] = useState<ProjectDetailTabKey>(initialTab);
  const [splitView, setSplitView] = useState(false);
  const [secondaryTab, setSecondaryTab] = useState<ProjectDetailTabKey>('notes');
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [loadError, setLoadError] = useState<string>('');
  const [aiError, setAiError] = useState('');
  const [openFieldSections, setOpenFieldSections] = useState<string[]>([]);
  // どの type key でセクション開閉を初期化済みか追跡する（undefined = 未初期化）
  const sectionInitTypeRef = useRef<string | undefined>(undefined);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoaded, setTodosLoaded] = useState(false);
  const [todosLoading, setTodosLoading] = useState(false);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [noteCreating, setNoteCreating] = useState(false);
  const [pendingNoteScrollTarget, setPendingNoteScrollTarget] = useState<string | null>(null);
  const [assetDirtyMap, setAssetDirtyMap] = useState<Record<string, boolean>>({});
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberMessage, setMemberMessage] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);
  const scrollOptions = useMemo(() => ({ behavior: 'smooth', block: 'center' } as const), []);
  const userDefaultTabAppliedRef = useRef(false);

  const loadProject = useCallback(async () => {
    setLoadError('');
    const projectRes = await fetch(withBasePath(`/api/projects/${id}`));
    const [projectTypesRes, globalAssetsRes, contentTemplatesRes] = await Promise.all([
      fetch(withBasePath('/api/project-types')),
      fetch(withBasePath('/api/master-data')),
      fetch(withBasePath('/api/content-templates')),
    ]);
    const [pr, projectTypesPayload, globalAssetsPayload, contentTemplatesPayload] = await Promise.all([
      projectRes.json(),
      projectTypesRes.json(),
      globalAssetsRes.json(),
      contentTemplatesRes.json(),
    ]);

    if (projectRes.status === 401) {
      setProject(null);
      setAssets([]);
      setTodos([]);
      setNotes([]);
      router.push(withBasePath('/login'));
      return;
    }

    if (projectRes.status === 404) {
      setProject(null);
      setAssets([]);
      setTodos([]);
      setNotes([]);
      setLoadError('このプロジェクトは見つからないか、アクセスできません。');
      return;
    }

    if (!projectRes.ok) {
      setProject(null);
      setAssets([]);
      setTodos([]);
      setNotes([]);
      setLoadError('プロジェクトの読み込みに失敗しました。');
      return;
    }

    setProject(normalizeProject(pr as ProjectWithFields));
    setProjectTypes(Array.isArray(projectTypesPayload.project_types) ? projectTypesPayload.project_types as ProjectTypeDefinition[] : []);
    setGlobalAssetObjects(Array.isArray(globalAssetsPayload.objects) ? globalAssetsPayload.objects as GlobalAssetObject[] : []);
    setContentTemplates(Array.isArray(contentTemplatesPayload.content_templates) ? contentTemplatesPayload.content_templates as ProjectContentTemplate[] : []);
  }, [id, router]);

  const loadAssets = useCallback(async (force = false) => {
    if (!force && (assetsLoaded || assetsLoading)) return;
    setAssetsLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/assets`));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 404) {
        setLoadError('このプロジェクトは見つからないか、アクセスできません。');
        setProject(null);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setAssets(Array.isArray(data) ? data as GeneratedAsset[] : []);
      setAssetsLoaded(true);
    } finally {
      setAssetsLoading(false);
    }
  }, [assetsLoaded, assetsLoading, id, router]);

  const loadTodos = useCallback(async (force = false) => {
    if (!force && (todosLoaded || todosLoading)) return;
    setTodosLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/todos`));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 404) {
        setLoadError('このプロジェクトは見つからないか、アクセスできません。');
        setProject(null);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setTodos(Array.isArray(data) ? data as Todo[] : []);
      setTodosLoaded(true);
    } finally {
      setTodosLoading(false);
    }
  }, [todosLoaded, todosLoading, id, router]);

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
    setAssets([]);
    setAssetsLoaded(false);
    setAssetsLoading(false);
    setTodos([]);
    setTodosLoaded(false);
    setTodosLoading(false);
    setNotes([]);
    setNotesLoaded(false);
    setNoteLoading(false);
    setNoteEditingId(null);
    setNoteDraft({ title: '', body: '' });
    setNoteCreating(false);
    setAssetDirtyMap({});
    setSuggestions([]);
    setAiError('');
  }, [id]);

  const currentProjectType = useMemo(
    () => projectTypes.find((definition) => definition.key === project?.type),
    [projectTypes, project?.type]
  );

  const hasInlineNoteWidget = useMemo(
    () => (currentProjectType?.sections ?? []).some((section) => section.items.some((item) => (item.kind ?? 'field') === 'note_list')),
    [currentProjectType]
  );

  const hasInlineTodoWidget = useMemo(
    () => (currentProjectType?.sections ?? []).some((section) =>
      section.items.some((item) => item.kind === 'todo_list' || item.kind === 'todo_summary')
    ),
    [currentProjectType]
  );

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

  useEffect(() => {
    if (!project) return;
    const currentType = projectTypes.find((definition) => definition.key === project.type);
    const fields = Array.isArray(project.custom_fields) ? project.custom_fields : [];
    const fieldsBySection = fields.reduce<Record<string, typeof fields>>((acc, field) => {
      const sectionName = field.section?.trim() || '詳細';
      if (!acc[sectionName]) acc[sectionName] = [];
      acc[sectionName].push(field);
      return acc;
    }, {});
    const definedSections = currentType?.sections ?? [];
    const definedSectionNames = definedSections.map((section) => section.name);
    const extraSectionNames = Array.from(new Set(fields.map((field) => field.section?.trim() || '詳細')))
      .filter((name) => !definedSectionNames.includes(name));
    // 定義済みセクションはすべて対象にする（fieldsBySection でフィルタすると
    // ウィジェットのみのセクションや section プロパティ不一致のセクションが脱落するため）
    const nextSectionOrder = [...definedSectionNames, ...extraSectionNames];

    const typeKey = currentType?.key;
    setOpenFieldSections((current) => {
      // 同じ type key で既に初期化済みならユーザーの開閉操作を維持する
      if (typeKey !== undefined && sectionInitTypeRef.current === typeKey) {
        const filtered = current.filter((name) => nextSectionOrder.includes(name));
        if (filtered.length > 0) return filtered;
      }
      // type が確定したタイミング（または type 変更時）に defaultOpen を適用する
      const defaultOpenSections = nextSectionOrder.filter(name => {
        const secDef = definedSections.find(s => s.name === name);
        return !secDef || (secDef.defaultOpen ?? true);
      });
      // type が確定している場合のみ初期化済みとしてマーク
      if (typeKey !== undefined) sectionInitTypeRef.current = typeKey;
      return defaultOpenSections.length > 0 ? defaultOpenSections : (nextSectionOrder[0] ? [nextSectionOrder[0]] : []);
    });
  }, [project, projectTypes]);

  async function save(p: ProjectWithFields) {
    if (!p.current_permissions?.can_edit) return;
    setSaving(true);
    await fetch(withBasePath(`/api/projects/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: p.name,
        type: p.type,
        phase_key: p.phase_key,
        status: p.status,
        primary_assignee_id: p.primary_assignee_id ?? null,
        ...(p.current_permissions?.can_edit_items ? { custom_fields: p.custom_fields } : {}),
      }),
    });
    setSaving(false);
    setSavingMsg('保存済み');
    setTimeout(() => setSavingMsg(''), 2000);
  }

  async function addProjectMember() {
    if (!memberUserId) return;
    setMemberSaving(true);
    setMemberMessage('');
    const res = await fetch(withBasePath(`/api/projects/${id}/members`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: memberUserId, role: memberRole }),
    });
    const payload = await res.json() as { error?: string };
    setMemberSaving(false);

    if (!res.ok) {
      setMemberMessage(payload.error || 'メンバー追加に失敗しました');
      return;
    }

    setMemberUserId('');
    setMemberRole('MEMBER');
    setMemberMessage('メンバーを更新しました');
    await loadProject();
  }

  async function updateProjectMemberRole(userId: string, role: string) {
    setMemberMessage('');
    const res = await fetch(withBasePath(`/api/projects/${id}/members`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    });
    if (!res.ok) {
      const payload = await res.json() as { error?: string };
      setMemberMessage(payload.error || 'ロール更新に失敗しました');
      return;
    }
    await loadProject();
  }

  async function removeProjectMember(userId: string) {
    if (!confirm('このメンバーをプロジェクトから外しますか？')) return;
    setMemberMessage('');
    const res = await fetch(withBasePath(`/api/projects/${id}/members?user_id=${encodeURIComponent(userId)}`), { method: 'DELETE' });
    if (!res.ok) {
      const payload = await res.json() as { error?: string };
      setMemberMessage(payload.error || 'メンバー削除に失敗しました');
      return;
    }
    await loadProject();
  }

  function updateField(idx: number, f: CustomField) {
    if (!project || idx < 0) return;
    const fields = [...project.custom_fields];
    fields[idx] = f;
    setProject({ ...project, custom_fields: fields });
  }

  function toggleFieldSection(sectionName: string) {
    setOpenFieldSections((current) =>
      current.includes(sectionName)
        ? current.filter((name) => name !== sectionName)
        : [...current, sectionName]
    );
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
        body: JSON.stringify({ asset_types: selectedContentKeys, additional_instruction: additionalGenerationInstruction, note_ids: Array.from(generateSelectedNoteIds) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setAiError(payload.error || 'AI生成に失敗しました。');
        return;
      }
      await loadAssets(true);
      if (splitView && primaryTab !== 'assets') {
        setSecondaryTab('assets');
      } else {
        setPrimaryTab('assets');
      }
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
      const res = await fetch(withBasePath(`/api/projects/${id}/complete`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additionalInstruction: completionAdditionalInstruction,
          noteIds: Array.from(completionSelectedNoteIds),
        }),
      });
      const data = await res.json() as { suggestions: CompletionSuggestion[]; error?: string; message?: string; raw_snippet?: string };
      if (!res.ok) {
        setAiError(data.error || 'AI補完に失敗しました。');
        return;
      }
      const s = data.suggestions ?? [];
      setSuggestions(s);
      setCompletionMessage(s.length === 0 ? (data.message || '補完候補が見つかりませんでした。') : '');
      if (data.raw_snippet) setCompletionRawSnippet(data.raw_snippet); else setCompletionRawSnippet('');
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
    if (!window.confirm('この生成コンテンツを削除しますか？')) return;
    await fetch(withBasePath(`/api/projects/${id}/assets?assetId=${assetId}`), { method: 'DELETE' });
    setAssets(a => a.filter(x => x.id !== assetId));
    setAssetDirtyMap((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }

  function updateAsset(updatedAsset: GeneratedAsset) {
    setAssets((current) => current.map((asset) => asset.id === updatedAsset.id ? updatedAsset : asset));
  }

  async function deleteProject() {
    if (!confirm('このプロジェクトを削除しますか？')) return;
    await fetch(withBasePath(`/api/projects/${id}`), { method: 'DELETE' });
    router.push(withBasePath('/'));
  }

  const loadNotes = useCallback(async (force = false) => {
    if (!force && (notesLoaded || noteLoading)) return;
    setNoteLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${id}/notes`));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 404) {
        setLoadError('このプロジェクトは見つからないか、アクセスできません。');
        setProject(null);
        return;
      }
      if (res.ok) {
        setNotes(await res.json());
        setNotesLoaded(true);
      }
    } finally {
      setNoteLoading(false);
    }
  }, [id, noteLoading, notesLoaded, router]);

  useEffect(() => {
    if (!project) return;
    const visibleTabs = new Set<ProjectDetailTabKey>(splitView ? [primaryTab, secondaryTab] : [primaryTab]);
    if (visibleTabs.has('assets')) void loadAssets();
    if (visibleTabs.has('tasks') || hasInlineTodoWidget) void loadTodos();
    if (visibleTabs.has('notes') || hasInlineNoteWidget || project.current_permissions?.can_view_notes) void loadNotes();
  }, [project, splitView, primaryTab, secondaryTab, hasInlineNoteWidget, hasInlineTodoWidget, loadAssets, loadTodos, loadNotes]);

  usePendingScrollTarget(
    pendingNoteScrollTarget,
    [notes, primaryTab, secondaryTab, splitView],
    setPendingNoteScrollTarget,
    scrollOptions,
  );

  async function createNote() {
    if (!noteDraft.title.trim() && !noteDraft.body.trim()) return;
    const res = await fetch(withBasePath(`/api/projects/${id}/notes`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteDraft),
    });
    if (res.ok) {
      const created = await res.json() as ProjectNote;
      setNotes(prev => [created, ...prev]);
      setPendingNoteScrollTarget(`project-note-${created.id}`);
      setNoteDraft({ title: '', body: '' });
      setNoteCreating(false);
    }
  }

  async function updateNote(noteId: string, patch: Partial<Pick<ProjectNote, 'title' | 'body' | 'pinned'>>) {
    const res = await fetch(withBasePath(`/api/projects/${id}/notes/${noteId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json() as ProjectNote;
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
    }
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm('このノートを削除しますか？')) return;
    const res = await fetch(withBasePath(`/api/projects/${id}/notes/${noteId}`), { method: 'DELETE' });
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  const editingNote = noteEditingId ? notes.find((note) => note.id === noteEditingId) ?? null : null;
  const noteCreateDirty = noteCreating && (noteDraft.title.trim().length > 0 || noteDraft.body.trim().length > 0);
  const noteEditDirty = Boolean(editingNote) && (noteDraft.title !== editingNote?.title || noteDraft.body !== editingNote?.body);
  const hasUnsavedEditors = noteCreateDirty || noteEditDirty || Object.values(assetDirtyMap).some(Boolean);

  const confirmLeaveUnsaved = useCallback((message = '未保存の変更があります。保存せずに移動しますか？') => {
    if (!hasUnsavedEditors) return true;
    return window.confirm(message);
  }, [hasUnsavedEditors]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedEditors) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEditors]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedEditors) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;
      if (!window.confirm('未保存の変更があります。保存せずに移動しますか？')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedEditors]);

  const allFields = useMemo(() => Array.isArray(project?.custom_fields) ? project.custom_fields : [], [project?.custom_fields]);
  const inheritedCount = useMemo(() => allFields.filter(f => f.inherited === 1).length, [allFields]);
  const currentContentTemplates = useMemo(
    () => contentTemplates.filter((template) => currentProjectType?.content_template_ids.includes(template.id)),
    [contentTemplates, currentProjectType]
  );
  const fieldByTemplateId = useMemo(
    () => new Map<string, CustomField>(allFields.filter(f => f.template_id).map(f => [f.template_id!, f])),
    [allFields]
  );
  const fieldIndexById = useMemo(
    () => new Map<string, number>(allFields.map((field, index) => [field.id, index])),
    [allFields]
  );
  const typeLabel = currentProjectType?.name || (project ? PROJECT_TYPE_LABELS[project.type as ProjectType] || project.type : '');
  const currentPhases = currentProjectType?.phases || [];
  const currentPhaseIndex = currentPhases.findIndex((phase) => phase.key === project?.phase_key);
  const assignableUsers = useMemo(() => Array.isArray(project?.assignable_users) ? project.assignable_users : [], [project?.assignable_users]);
  const currentPermissions = project?.current_permissions;
  const canManageMembers = Boolean(currentPermissions?.can_manage_members);
  const canEditProject = Boolean(currentPermissions?.can_edit);
  const canEditItems = Boolean(currentPermissions?.can_edit_items);
  const canViewItems = Boolean(currentPermissions?.can_view_items);
  const canViewContent = Boolean(currentPermissions?.can_view_content);
  const canGenerateContent = Boolean(currentPermissions?.can_generate_content);
  const canViewNotes = Boolean(currentPermissions?.can_view_notes);
  const canEditNotes = Boolean(currentPermissions?.can_edit_notes);
  const canDeleteProject = Boolean(currentPermissions?.can_delete);
  const projectRoleDefinitions = project?.project_role_definitions ?? [];
  const tabOptions = useMemo(() => ([
    ...(canViewItems ? [{ k: 'fields' as const, l: 'プロジェクト情報' }] : []),
    ...(canViewItems ? [{ k: 'tasks' as const, l: 'タスク' }] : []),
    ...(canViewItems ? [{ k: 'members' as const, l: 'メンバー' }] : []),
    ...(canViewNotes ? [{ k: 'notes' as const, l: 'ノート' }] : []),
    ...(canViewContent ? [{ k: 'assets' as const, l: '生成コンテンツ' }] : []),
  ]), [canViewContent, canViewItems, canViewNotes]);

  const findAlternateTab = useCallback((current: ProjectDetailTabKey) => {
    return tabOptions.find((option) => option.k !== current)?.k ?? current;
  }, [tabOptions]);

  useEffect(() => {
    if (requestedTab) return;
    const preferredTab = user?.settings?.default_project_tab;
    if (!preferredTab) return;
    if (!tabOptions.some((option) => option.k === preferredTab)) return;
    if (userDefaultTabAppliedRef.current) return;
    setPrimaryTab(preferredTab);
    userDefaultTabAppliedRef.current = true;
  }, [requestedTab, tabOptions, user?.settings?.default_project_tab]);

  useEffect(() => {
    if (!tabOptions.some((option) => option.k === primaryTab)) {
      setPrimaryTab(tabOptions[0]?.k ?? 'fields');
    }
  }, [primaryTab, tabOptions]);

  useEffect(() => {
    if (!splitView) return;
    if (!tabOptions.some((option) => option.k === secondaryTab)) {
      setSecondaryTab(findAlternateTab(primaryTab));
      return;
    }
    if (secondaryTab === primaryTab) {
      setSecondaryTab(findAlternateTab(primaryTab));
    }
  }, [findAlternateTab, primaryTab, secondaryTab, splitView, tabOptions]);

  const setPaneTab = useCallback((pane: 'primary' | 'secondary', nextTab: ProjectDetailTabKey) => {
    const currentTab = pane === 'primary' ? primaryTab : secondaryTab;
    if (currentTab === nextTab) return;
    if (!confirmLeaveUnsaved()) return;
    if (pane === 'primary') {
      if (splitView && nextTab === secondaryTab) {
        setSecondaryTab(primaryTab);
      }
      setPrimaryTab(nextTab);
      return;
    }
    if (nextTab === primaryTab) {
      setPrimaryTab(secondaryTab);
    }
    setSecondaryTab(nextTab);
  }, [confirmLeaveUnsaved, primaryTab, secondaryTab, splitView]);

  const noteTabVisible = splitView ? (primaryTab === 'notes' || secondaryTab === 'notes') : primaryTab === 'notes';

  const noteSaveHandler = useMemo(() => {
    if (!noteTabVisible) return undefined;
    if (noteCreating && canEditNotes) return createNote;
    if (noteEditingId && canEditNotes) {
      const editId = noteEditingId;
      return async () => {
        await updateNote(editId, { title: noteDraft.title, body: noteDraft.body });
        setNoteEditingId(null);
      };
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTabVisible, noteCreating, noteEditingId, canEditNotes, noteDraft]);

  useRegisterShortcutScope(`project-${id}`, project?.name ? `${project.name}` : 'プロジェクト詳細', {
    save_current: noteSaveHandler ?? (project && (primaryTab === 'fields' || (splitView && secondaryTab === 'fields')) && canEditProject ? () => save(project) : undefined),
    new_record: noteTabVisible && canEditNotes
      ? () => {
          if (noteCreating) return;
          if (!confirmLeaveUnsaved()) return;
          setNoteCreating(true);
        }
      : undefined,
  });
  const roleLabel = (role: string) => projectRoleDefinitions.find((item) => item.key === role)?.name ?? role;
  const projectMemberUserIds = useMemo(() => new Set((project?.members ?? []).map((member) => member.user.id)), [project?.members]);
  const selectableProjectUsers = useMemo(
    () => (project?.registered_users ?? []).filter((candidate) =>
      candidate.id !== project?.owner?.id && !projectMemberUserIds.has(candidate.id)
    ),
    [project?.registered_users, project?.owner?.id, projectMemberUserIds]
  );
  const primaryAssignee = assignableUsers.find((item) => item.id === project?.primary_assignee_id) ?? project?.primary_assignee ?? null;

  // フィールドをセクション別にグループ化
  const fieldsBySection = useMemo(() => allFields.reduce<Record<string, typeof allFields>>((acc, f) => {
    const sec = f.section?.trim() || '詳細';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(f);
    return acc;
  }, {}), [allFields]);
  // セクション表示順：種別定義のsections順 → それ以外は末尾に追加
  const definedSections = currentProjectType?.sections ?? [];
  const definedSectionNames = useMemo(() => definedSections.map((s) => s.name), [definedSections]);
  const extraSectionNames = useMemo(
    () => Array.from(new Set(allFields.map(f => f.section?.trim() || '詳細'))).filter((n) => !definedSectionNames.includes(n)),
    [allFields, definedSectionNames]
  );
  const sectionOrder = useMemo(
    () => [...definedSectionNames.filter((n) => fieldsBySection[n]), ...extraSectionNames],
    [definedSectionNames, fieldsBySection, extraSectionNames]
  );
  const sectionColorMap = useMemo(() => Object.fromEntries(definedSections.map((s) => [s.name, s.color])), [definedSections]);

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

  const renderTabContent = (tabKey: ProjectDetailTabKey, pane: 'primary' | 'secondary') => {
    if (tabKey === 'tasks' && canViewItems) {
      return (
        <section className="space-y-4">
          {todosLoading && !todosLoaded ? (
            <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">タスクを読み込み中...</p>
            </div>
          ) : (
            <TodoTab
              projectId={id}
              todos={todos}
              assignableUsers={project.assignable_users ?? []}
              phases={projectTypes.find(pt => pt.key === project.type)?.phases ?? []}
              canEdit={canEditItems}
              onTodosChange={setTodos}
            />
          )}
        </section>
      );
    }

    if (tabKey === 'notes' && canViewNotes) {
      return (
        <section className="space-y-4">
          {noteCreating ? (
            <div className="card p-4">
              <MarkdownRichTextEditor
                title={noteDraft.title}
                body={noteDraft.body}
                onTitleChange={v => setNoteDraft(d => ({ ...d, title: v }))}
                onBodyChange={v => setNoteDraft(d => ({ ...d, body: v }))}
                onSave={createNote}
                onCancel={() => { setNoteCreating(false); setNoteDraft({ title: '', body: '' }); }}
                saveLabel="作成"
                bodyLabel="本文"
                isDirty={noteCreateDirty}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                if (!confirmLeaveUnsaved()) return;
                setNoteCreating(true);
              }}
              disabled={!canEditNotes}
              className="btn-secondary w-full justify-center text-sm"
            >
              + 新しいノートを作成
            </button>
          )}

          {noteLoading ? (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
          ) : notes.length === 0 ? (
            <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">ノートはありません</p>
              <p className="text-xs mt-1">「新しいノートを作成」から追加してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} id={`project-note-${note.id}`} className="card overflow-hidden">
                  {noteEditingId === note.id ? (
                    <div className="p-4">
                      <MarkdownRichTextEditor
                        title={noteDraft.title}
                        body={noteDraft.body}
                        onTitleChange={v => setNoteDraft(d => ({ ...d, title: v }))}
                        onBodyChange={v => setNoteDraft(d => ({ ...d, body: v }))}
                        onSave={async () => {
                          await updateNote(note.id, { title: noteDraft.title, body: noteDraft.body });
                          setNoteEditingId(null);
                        }}
                        onCancel={() => setNoteEditingId(null)}
                        bodyLabel="本文"
                        isDirty={noteEditDirty}
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {note.pinned === 1 && <span className="text-sm shrink-0">📌</span>}
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {note.title || '（無題）'}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateNote(note.id, { pinned: note.pinned === 1 ? 0 : 1 })}
                            disabled={!canEditNotes}
                            title={note.pinned === 1 ? 'ピン留めを外す' : 'ピン留め'}
                            className="p-1 rounded transition-colors text-sm"
                            style={{ color: note.pinned === 1 ? 'var(--accent)' : 'var(--text-muted)', opacity: note.pinned === 1 ? 1 : 0.4 }}
                          >
                            📌
                          </button>
                          <button
                            disabled={!canEditNotes}
                            onClick={() => {
                              if (!confirmLeaveUnsaved()) return;
                              setNoteEditingId(note.id);
                              setNoteDraft({ title: note.title, body: note.body });
                            }}
                            className="px-2 py-1 rounded transition-colors text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            disabled={!canEditNotes}
                            className="px-2 py-1 rounded transition-colors text-xs"
                            style={{ color: '#b34a4a' }}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      {note.body && (
                        <MarkdownViewer content={note.body} className="text-sm" />
                      )}
                      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        更新: {new Date(note.updated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (tabKey === 'members' && canViewItems) {
      return (
        <section className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="section-title">主担当</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                プロジェクト全体の代表担当者です。Todo/KANBAN/WBSの担当者フィルタでも使います。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="field-label">主担当者</label>
                <select
                  className="field-input"
                  value={project.primary_assignee_id ?? ''}
                  disabled={!canEditProject}
                  onChange={(e) => setProject({ ...project, primary_assignee_id: e.target.value || null })}
                >
                  <option value="">未設定</option>
                  {assignableUsers.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {userDisplayName(assignee)} / {assignee.email}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={() => save(project)} disabled={saving || !canEditProject} className="btn-primary text-sm">
                主担当を保存
              </button>
            </div>
            <div className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.66)' }}>
              {primaryAssignee?.avatar_url ? (
                <img src={primaryAssignee.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'var(--border)' }} />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                  {primaryAssignee ? userInitials(primaryAssignee) : '未'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{primaryAssignee ? userDisplayName(primaryAssignee) : '未設定'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{primaryAssignee?.email ?? '主担当が設定されていません'}</p>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="section-title">メンバー</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                登録済みユーザーだけをプロジェクトに追加できます。未登録ユーザーを追加する場合は、先にユーザー管理で作成してください。
              </p>
            </div>

            {canManageMembers && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.66)' }}>
                <div>
                  <label className="field-label">追加するユーザー</label>
                  <select className="field-input" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                    <option value="">登録済みユーザーを選択</option>
                    {selectableProjectUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {userDisplayName(candidate)} / {candidate.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">プロジェクトロール</label>
                  <select className="field-input" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                    {projectRoleDefinitions.map((role) => (
                      <option key={role.key} value={role.key}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={addProjectMember} disabled={memberSaving || !memberUserId} className="btn-secondary text-sm">
                  {memberSaving ? '追加中...' : '追加'}
                </button>
                {memberMessage && (
                  <p className="md:col-span-3 text-xs" style={{ color: memberMessage === 'メンバーを更新しました' ? 'var(--success)' : '#b34a4a' }}>
                    {memberMessage}
                  </p>
                )}
              </div>
            )}

            <div className="divide-y divide-slate-200/70">
              {project.owner && (
                <div className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'rgba(31,157,114,0.1)', color: 'var(--success)' }}>
                    {userInitials(project.owner)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{userDisplayName(project.owner)}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{project.owner.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(31,157,114,0.1)', color: 'var(--success)' }}>オーナー</span>
                </div>
              )}
              {(project.members ?? []).map((member) => (
                <div key={member.user.id} className="py-3 flex items-center gap-3">
                  {member.user.avatar_url ? (
                    <img src={member.user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'var(--border)' }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                      {userInitials(member.user)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{userDisplayName(member.user)}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.user.email}</p>
                  </div>
                  {canManageMembers ? (
                    <select className="field-input text-xs py-1.5 w-52" value={member.role} onChange={(e) => updateProjectMemberRole(member.user.id, e.target.value)}>
                      {projectRoleDefinitions.map((role) => (
                        <option key={role.key} value={role.key}>{role.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>{roleLabel(member.role)}</span>
                  )}
                  {canManageMembers && (
                    <button onClick={() => removeProjectMember(member.user.id)} className="btn-danger text-xs px-2 py-1">
                      外す
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (tabKey === 'fields' && canViewItems) {
      return (
        <>
          {(() => {
            type RenderItem =
              | { type: 'field'; field: CustomField; layout: string; key: string }
              | { type: 'widget'; kind: string; layout: string; key: string };

            const renderSection = (
              secId: string,
              secName: string,
              secColor: string | undefined,
              renderItems: RenderItem[]
            ) => {
              if (renderItems.length === 0) return null;
              const isOpen = openFieldSections.includes(secName);
              return (
                <section key={secId}>
                  <div className="card overflow-hidden">
                    {secColor && <div style={{ height: 3, backgroundColor: secColor, opacity: 0.6 }} />}
                    <button type="button" onClick={() => toggleFieldSection(secName)} className="row-hover w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        {secColor && <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: secColor }} />}
                        <h2 className="section-title" style={secColor ? { color: secColor } : undefined}>{secName}</h2>
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{isOpen ? '▲ 閉じる' : '▼ 開く'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 grid grid-cols-2 gap-4">
                        {renderItems.map(item => {
                          if (item.type === 'widget') {
                            return (
                              <SectionInfoWidget
                                key={item.key}
                                kind={item.kind}
                                layout={item.layout as 'half' | 'full'}
                                project={project}
                                projectType={currentProjectType}
                                phases={currentPhases}
                                typeLabel={typeLabel}
                                notes={notes}
                                todos={todos}
                                todosLoading={todosLoading}
                                members={assignableUsers}
                                onNotesTabClick={() => setPaneTab(pane, 'notes')}
                                onTasksTabClick={() => setPaneTab(pane, 'tasks')}
                              />
                            );
                          }
                          const f = item.field;
                          const globalIdx = fieldIndexById.get(f.id) ?? -1;
                          return (
                            <div key={item.key} className={item.layout === 'full' ? 'col-span-2' : ''}>
                              <CustomFieldRow field={f} globalAssetObjects={globalAssetObjects} onChange={nf => updateField(globalIdx, nf)} onCrawl={() => crawlField(f.id)} crawling={crawlingFieldId === f.id} showFieldKeys={devSettings.showFieldKeys} showFieldTypes={devSettings.showFieldTypes} showFieldIds={devSettings.showFieldIds} showFieldListBorders={devSettings.showFieldListBorders} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            };

            return (
              <>
                {definedSections.map(secDef => {
                  const items: RenderItem[] = secDef.items.flatMap((item): RenderItem[] => {
                    const kind = item.kind ?? 'field';
                    if (kind !== 'field') {
                      return [{ type: 'widget', kind, layout: item.layout, key: item.id }];
                    }
                    const field = fieldByTemplateId.get(item.field_id);
                    if (!field) return [];
                    return [{ type: 'field', field, layout: item.layout, key: item.id }];
                  });
                  const fallback = secDef.items.length === 0
                    ? (fieldsBySection[secDef.name] ?? []).map(f => ({ type: 'field' as const, field: f, layout: f.layout || 'half', key: f.id }))
                    : [];
                  return renderSection(secDef.id, secDef.name, secDef.color, [...items, ...fallback]);
                })}

                {extraSectionNames.map(sec => {
                  const items = (fieldsBySection[sec] ?? []).map(f => ({ type: 'field' as const, field: f, layout: f.layout || 'half', key: f.id }));
                  return renderSection(`extra-${sec}`, sec, undefined, items);
                })}

                {definedSections.length === 0 && extraSectionNames.length === 0 && (
                  <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm">このプロジェクト種別には項目がありません</p>
                    <p className="text-xs mt-1">プロジェクト種別設定で項目を追加してください</p>
                  </div>
                )}
              </>
            );
          })()}

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
      );
    }

    if (tabKey === 'assets' && canViewContent) {
      return (
        <section>
          {assetsLoading && !assetsLoaded ? (
            <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <p>生成コンテンツを読み込み中...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <p>まだコンテンツは生成されていません</p>
              <p className="text-xs mt-1">右パネルから生成対象を選んで実行してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map(a => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  onDelete={() => deleteAsset(a.id)}
                  onSaved={updateAsset}
                  onDirtyChange={(assetId, dirty) => {
                    setAssetDirtyMap((current) => {
                      if (current[assetId] === dirty) return current;
                      return { ...current, [assetId]: dirty };
                    });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <section>
        <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">この情報を表示する権限がありません</p>
        </div>
      </section>
    );
  };

  const renderPaneTabs = (currentTab: ProjectDetailTabKey, pane: 'primary' | 'secondary') => (
    <div className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex gap-2 flex-wrap">
        {tabOptions.map((option) => (
          <button
            key={`${pane}-${option.k}`}
            onClick={() => setPaneTab(pane, option.k)}
            className={`tab-btn${currentTab === option.k ? ' active' : ''}`}
          >
            {option.l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!splitView && tabOptions.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const nextSecondary = findAlternateTab(primaryTab);
              setSecondaryTab(nextSecondary);
              setSplitView(true);
            }}
            className="btn-secondary text-xs"
          >
            2画面表示
          </button>
        )}
        {splitView && pane === 'secondary' && (
          <button type="button" onClick={() => setSplitView(false)} className="btn-secondary text-xs">
            分割解除
          </button>
        )}
      </div>
    </div>
  );

  const renderPane = (currentTab: ProjectDetailTabKey, pane: 'primary' | 'secondary') => (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      <div className="shrink-0">
        {renderPaneTabs(currentTab, pane)}
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pt-6 pr-3 space-y-6">
        {renderTabContent(currentTab, pane)}
      </div>
    </div>
  );

  const startSplitResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startRatio = splitRatio;
    const handleMove = (moveEvent: MouseEvent) => {
      const viewportWidth = window.innerWidth || 1;
      const deltaRatio = (moveEvent.clientX - startX) / viewportWidth;
      const nextRatio = Math.min(0.72, Math.max(0.28, startRatio + deltaRatio));
      setSplitRatio(nextRatio);
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* ヘッダー */}
      <div className="border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, #ffffff 0%, rgba(241,250,252,0.95) 100%)' }}>
        {/* 1行: 戻る | タイトル + バッジ類 | ステータス + 保存 + 削除 */}
        <div className="px-6 py-3 flex items-center gap-3">
          {/* 戻るボタン */}
          <button
            onClick={() => {
              if (!confirmLeaveUnsaved()) return;
              router.push(withBasePath('/'));
            }}
            className="inline-flex items-center gap-1 text-xs font-medium shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            一覧
          </button>

          <span style={{ color: 'var(--border)', fontSize: 18, lineHeight: 1 }}>|</span>

          {/* タイトル */}
          <input
            className="bg-transparent text-lg font-bold focus:outline-none transition-colors leading-tight flex-1 min-w-0"
            style={{ color: 'var(--text-primary)', borderBottom: '2px solid transparent' }}
            onFocus={e => (e.target.style.borderBottomColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
            value={project.name}
            disabled={!canEditProject}
            onChange={e => setProject({ ...project, name: e.target.value })}
          />

          {/* バッジ群（種別・クローン・要確認） */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold"
              style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)', border: '1px solid rgba(15,154,177,0.2)' }}
            >
              {typeLabel}
            </span>
            {project.cloned_from && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem]" style={{ backgroundColor: 'rgba(111,135,148,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                クローン
              </span>
            )}
            {inheritedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-medium" style={{ backgroundColor: 'rgba(215,138,29,0.1)', color: '#b66a10', border: '1px solid rgba(215,138,29,0.22)' }}>
                ⚠ {inheritedCount}件
              </span>
            )}
          </div>

          {/* ステータス・ピルセレクター */}
          <div className="flex items-center rounded-xl overflow-hidden border shrink-0" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.7)' }}>
            {([
              { value: 'draft',    label: '下書き',   dot: '#9fb8c4' },
              { value: 'active',   label: 'アクティブ', dot: '#1f9d72' },
              { value: 'archived', label: 'アーカイブ', dot: '#9fb8c4' },
            ] as { value: typeof project.status; label: string; dot: string }[]).map((opt, i) => {
              const isSelected = project.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!canEditProject}
                  onClick={() => setProject({ ...project, status: opt.value })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                    background: isSelected
                      ? opt.value === 'active'
                        ? 'linear-gradient(135deg, rgba(31,157,114,0.15) 0%, rgba(183,244,216,0.4) 100%)'
                        : opt.value === 'draft'
                          ? 'linear-gradient(135deg, rgba(15,154,177,0.1) 0%, rgba(126,215,222,0.2) 100%)'
                          : 'rgba(159,184,196,0.12)'
                      : 'transparent',
                    color: isSelected
                      ? opt.value === 'active' ? 'var(--success)' : opt.value === 'draft' ? 'var(--accent)' : 'var(--text-secondary)'
                      : 'var(--text-muted)',
                  }}
                >
                  <span
                    className="inline-block rounded-full shrink-0"
                    style={{
                      width: 7, height: 7,
                      backgroundColor: isSelected ? opt.dot : 'var(--border)',
                      boxShadow: isSelected ? `0 0 0 2px ${opt.dot}44` : 'none',
                    }}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* 保存・削除 */}
          {savingMsg && (
            <span className="inline-flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--success)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {savingMsg}
            </span>
          )}
          <button onClick={() => save(project)} disabled={saving || !canEditProject} className="btn-primary text-sm shrink-0">
            {saving ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                保存中...
              </span>
            ) : '保存'}
          </button>
          {canDeleteProject && <button onClick={deleteProject} className="btn-danger text-xs shrink-0">削除</button>}
        </div>

        {/* 進行パス（Salesforce Path スタイル・全幅均等） */}
        {currentPhases.length > 0 ? (
          <div>
            {/* パス本体: flex で全幅均等分割 */}
            <div className="flex w-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {currentPhases.map((phase, phaseIndex) => {
                const isCurrent = phase.key === project.phase_key;
                const isCompleted = currentPhaseIndex >= 0 && phaseIndex < currentPhaseIndex;
                const isFirst = phaseIndex === 0;
                const isLast = phaseIndex === currentPhases.length - 1;

                const bgColor = isCurrent
                  ? '#0f9ab1'
                  : isCompleted
                    ? '#1f9d72'
                    : 'rgba(241,250,252,0.9)';
                const textColor = isCurrent || isCompleted ? '#ffffff' : 'var(--text-secondary)';

                return (
                  <button
                    key={phase.id}
                    type="button"
                    disabled={!canEditProject}
                    onClick={() => setProject({ ...project, phase_key: phase.key })}
                    title={`フェーズを「${phase.name}」に切り替え`}
                    className="group relative flex flex-1 h-10 items-center justify-center transition-all focus:outline-none"
                    style={{
                      minWidth: 80,
                      paddingLeft: isFirst ? 16 : 24,
                      paddingRight: isLast ? 16 : 8,
                      background: bgColor,
                      color: textColor,
                      clipPath: isFirst
                        ? isLast
                          ? 'inset(0)'
                          : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
                        : isLast
                          ? 'polygon(0 0, 14px 50%, 0 100%, 100% 100%, 100% 0)'
                          : 'polygon(0 0, 14px 50%, 0 100%, calc(100% - 14px) 100%, 100% 50%, calc(100% - 14px) 0)',
                      filter: isCurrent ? 'drop-shadow(0 3px 8px rgba(15,154,177,0.3))' : 'none',
                      zIndex: currentPhases.length - phaseIndex,
                      marginLeft: isFirst ? 0 : -2,
                      border: 'none',
                      outline: 'none',
                    }}
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    {/* アイコン */}
                    <span
                      className="relative z-10 inline-flex shrink-0 items-center justify-center rounded-full mr-1.5"
                      style={{
                        width: 18, height: 18,
                        backgroundColor: isCurrent || isCompleted ? 'rgba(255,255,255,0.22)' : 'rgba(15,154,177,0.1)',
                        color: isCurrent || isCompleted ? '#fff' : 'var(--text-muted)',
                        fontSize: 10, fontWeight: 700,
                      }}
                    >
                      {isCompleted ? (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        phaseIndex + 1
                      )}
                    </span>
                    {/* 名前 */}
                    <span className="relative z-10 text-xs font-semibold truncate" style={{ color: textColor }}>{phase.name}</span>
                  </button>
                );
              })}
            </div>
            {/* プログレスバー: パスと同じ幅で確実に揃う */}
            <div className="w-full h-[3px]" style={{ background: 'var(--border)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  background: 'linear-gradient(90deg, #1f9d72 0%, #0f9ab1 100%)',
                  width: currentPhaseIndex >= 0
                    ? `${Math.round(((currentPhaseIndex + 1) / currentPhases.length) * 100)}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="px-6 pb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            この種別にはまだフェーズ定義がありません。プロジェクト種別設定で追加してください。
          </div>
        )}
      </div>
      
      {/* 本体 */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden p-6 flex flex-col">
          {splitView ? (
            <div className="h-full min-h-0 flex flex-col">
              <div className="hidden xl:flex h-full min-h-0">
                <div className="min-h-0 min-w-0 pr-4 flex flex-col" style={{ flex: splitRatio }}>
                  {renderPane(primaryTab, 'primary')}
                </div>
                <div className="shrink-0 flex items-stretch">
                  <button
                    type="button"
                    onMouseDown={startSplitResize}
                    className="w-4 -mx-2 cursor-col-resize relative flex items-center justify-center"
                    aria-label="表示幅を調整"
                  >
                    <span className="w-px self-stretch" style={{ backgroundColor: 'var(--border)' }} />
                    <span
                      className="absolute w-1.5 h-10 rounded-full"
                      style={{ backgroundColor: 'rgba(15,154,177,0.14)', border: '1px solid rgba(15,154,177,0.18)' }}
                    />
                  </button>
                </div>
                <div className="min-h-0 min-w-0 pl-4 flex flex-col" style={{ flex: 1 - splitRatio }}>
                  {renderPane(secondaryTab, 'secondary')}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 h-full min-h-0 xl:hidden">
                {renderPane(primaryTab, 'primary')}
                {renderPane(secondaryTab, 'secondary')}
              </div>
            </div>
          ) : (
            renderPane(primaryTab, 'primary')
          )}
        </div>

        {/* 右: AI生成パネル */}
        <div className="w-80 shrink-0 border-l overflow-y-auto p-5 space-y-5" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(241,250,252,0.9) 100%)' }}>
          <h2 className="section-title">コンテンツ生成</h2>

          {/* 生成コンテンツ選択 */}
          {canViewContent && <div>
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
          </div>}

          {/* 生成ボタン */}
          <button
            onClick={generate}
            disabled={generating || selectedContentKeys.length === 0 || !canGenerateContent}
            className="btn-primary w-full justify-center py-2.5"
          >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-cyan-100 border-t-transparent rounded-full animate-spin" />
                  生成中...
                </span>
              ) : `選択中の ${selectedContentKeys.length} 件を生成`}
          </button>

          <div className="space-y-3">
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
            {canViewNotes && notes.length > 0 && (
              <NotePickerButton
                notes={notes}
                selectedIds={generateSelectedNoteIds}
                onChange={setGenerateSelectedNoteIds}
              />
            )}
          </div>

          {canGenerateContent && <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>項目自動補完</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>既存の情報を元に、未入力項目の値をAIが推測します</p>

            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>追加指示（任意）</p>
              <textarea
                className="field-input text-xs"
                rows={3}
                value={completionAdditionalInstruction}
                onChange={(e) => setCompletionAdditionalInstruction(e.target.value)}
                placeholder="補完時に考慮してほしい条件や背景を入力"
              />
            </div>

            {canViewNotes && notes.length > 0 && (
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
          </div>}

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

          {inheritedCount > 0 && (
            <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 243, 224, 0.8)', borderColor: 'rgba(215,138,29,0.25)' }}>
              <p className="text-xs font-semibold" style={{ color: '#b66a10' }}>⚠ 継承項目あり</p>
              <p className="text-xs mt-1" style={{ color: '#9a6213' }}>{inheritedCount}件の項目が前回施策から継承されています。生成前に確認を推奨します。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
