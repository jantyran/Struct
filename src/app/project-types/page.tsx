'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { GlobalAssetObject, ProjectContentTemplate, ProjectFieldTemplate, ProjectPhase, ProjectTypeDefinition } from '@/types';
import { FIELD_TYPE_LABELS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { createProjectTypeDefinition, defaultProjectTypeDefinitions } from '@/lib/project-types';

function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

type FieldOptionState = {
  choices?: string[];
  referenceObjectId?: string;
  children?: ProjectFieldTemplate[];
};

function parseFieldOptions(options: string) {
  try {
    const parsed = JSON.parse(options || '{}');
    if (Array.isArray(parsed)) return { choices: parsed as string[] };
    return parsed as FieldOptionState;
  } catch {
    return {};
  }
}

function serializeFieldOptions(options: FieldOptionState) {
  return JSON.stringify(options);
}

function createChildTemplate(index: number): ProjectFieldTemplate {
  return {
    id: uuidv4(),
    key: `child_${index + 1}`,
    label: `子項目 ${index + 1}`,
    type: 'text',
    options: '{}',
    layout: 'half',
  };
}

function ChildFieldTemplateRow({
  field,
  globalAssetObjects,
  onChange,
  onRemove,
}: {
  field: ProjectFieldTemplate;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (field: ProjectFieldTemplate) => void;
  onRemove: () => void;
}) {
  const options = parseFieldOptions(field.options);

  return (
    <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <div className="grid grid-cols-[1.2fr_1fr_160px_120px_80px] gap-2 items-end">
        <div>
          <label className="field-label">子項目名</label>
          <input className="field-input text-sm" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        </div>
        <div>
          <label className="field-label">キー</label>
          <input className="field-input text-sm" value={field.key} onChange={(e) => onChange({ ...field, key: e.target.value.replace(/\s+/g, '_') })} />
        </div>
        <div>
          <label className="field-label">種別</label>
          <select
            className="field-input text-sm"
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value as ProjectFieldTemplate['type'];
              const nextOptions = nextType === 'select'
                ? serializeFieldOptions({ choices: options.choices ?? [] })
                : nextType === 'reference' || nextType === 'reference_multi'
                  ? serializeFieldOptions({ referenceObjectId: options.referenceObjectId || '' })
                  : '{}';
              onChange({ ...field, type: nextType, options: nextOptions });
            }}
          >
            {Object.entries(FIELD_TYPE_LABELS)
              .filter(([type]) => !['group', 'group_list'].includes(type))
              .map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="field-label">表示幅</label>
          <select className="field-input text-sm" value={field.layout || 'half'} onChange={(e) => onChange({ ...field, layout: e.target.value as ProjectFieldTemplate['layout'] })}>
            <option value="half">2列</option>
            <option value="full">1列</option>
          </select>
        </div>
        <button onClick={onRemove} className="btn-danger">削除</button>
      </div>

      {field.type === 'select' && (
        <div>
          <label className="field-label">選択肢（カンマ区切り）</label>
          <input
            className="field-input text-sm"
            value={(options.choices ?? []).join(', ')}
            onChange={(e) => onChange({ ...field, options: serializeFieldOptions({ choices: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }) })}
          />
        </div>
      )}

      {(field.type === 'reference' || field.type === 'reference_multi') && (
        <div>
          <label className="field-label">参照オブジェクト</label>
          <select
            className="field-input text-sm"
            value={options.referenceObjectId || ''}
            onChange={(e) => onChange({ ...field, options: serializeFieldOptions({ referenceObjectId: e.target.value }) })}
          >
            <option value="">（選択してください）</option>
            {globalAssetObjects.map((object) => (
              <option key={object.id} value={object.id}>{object.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function PhaseRow({
  phase,
  dragging,
  onDragStart,
  onDrop,
  onChange,
  onRemove,
}: {
  phase: ProjectPhase;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onChange: (phase: ProjectPhase) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`grid grid-cols-[28px_1.2fr_1fr_80px] gap-2 items-end rounded-xl border p-3 ${dragging ? 'opacity-60' : ''}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.68)' }}
    >
      <div className="text-sm text-center cursor-grab select-none" style={{ color: 'var(--text-muted)' }}>⋮⋮</div>
      <div>
        <label className="field-label">フェーズ名</label>
        <input className="field-input text-sm" value={phase.name} onChange={(e) => onChange({ ...phase, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">キー</label>
        <input className="field-input text-sm" value={phase.key} onChange={(e) => onChange({ ...phase, key: e.target.value.replace(/\s+/g, '_') })} />
      </div>
      <button onClick={onRemove} className="btn-danger">削除</button>
    </div>
  );
}

function FieldTemplateRow({
  field,
  globalAssetObjects,
  dragging,
  onDragStart,
  onDrop,
  onChange,
  onRemove,
}: {
  field: ProjectFieldTemplate;
  globalAssetObjects: GlobalAssetObject[];
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onChange: (field: ProjectFieldTemplate) => void;
  onRemove: () => void;
}) {
  const options = parseFieldOptions(field.options);
  const childFields = options.children ?? [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`rounded-md border p-3 space-y-3 ${dragging ? 'opacity-60' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="grid grid-cols-[28px_1.2fr_1fr_160px_120px_80px] gap-2 items-end">
        <div className="text-sm text-center cursor-grab select-none" style={{ color: 'var(--text-muted)' }}>⋮⋮</div>
        <div>
          <label className="field-label">項目名</label>
          <input className="field-input text-sm" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        </div>
        <div>
          <label className="field-label">キー</label>
          <input className="field-input text-sm" value={field.key} onChange={(e) => onChange({ ...field, key: e.target.value.replace(/\s+/g, '_') })} />
        </div>
        <div>
          <label className="field-label">種別</label>
          <select
            className="field-input text-sm"
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value as ProjectFieldTemplate['type'];
              const nextOptions = nextType === 'select'
                ? serializeFieldOptions({ choices: options.choices ?? [] })
                : nextType === 'reference' || nextType === 'reference_multi'
                  ? serializeFieldOptions({ referenceObjectId: options.referenceObjectId || '' })
                  : nextType === 'group' || nextType === 'group_list'
                    ? serializeFieldOptions({ children: options.children ?? [] })
                    : '{}';
              onChange({ ...field, type: nextType, options: nextOptions });
            }}
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">表示幅</label>
          <select className="field-input text-sm" value={field.layout || 'half'} onChange={(e) => onChange({ ...field, layout: e.target.value as ProjectFieldTemplate['layout'] })}>
            <option value="half">2列</option>
            <option value="full">1列</option>
          </select>
        </div>
        <button onClick={onRemove} className="btn-danger">削除</button>
      </div>

      {field.type === 'select' && (
        <div>
          <label className="field-label">選択肢（カンマ区切り）</label>
          <input
            className="field-input text-sm"
            value={(options.choices ?? []).join(', ')}
            onChange={(e) => onChange({
              ...field,
              options: serializeFieldOptions({ choices: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }),
            })}
            placeholder="例: 高, 中, 低"
          />
        </div>
      )}

      {(field.type === 'reference' || field.type === 'reference_multi') && (
        <div>
          <label className="field-label">参照オブジェクト</label>
          <select
            className="field-input text-sm"
            value={options.referenceObjectId || ''}
            onChange={(e) => onChange({
              ...field,
              options: serializeFieldOptions({ referenceObjectId: e.target.value }),
            })}
          >
            <option value="">（選択してください）</option>
            {globalAssetObjects.map((object) => (
              <option key={object.id} value={object.id}>{object.name}</option>
            ))}
          </select>
        </div>
      )}

      {(field.type === 'group' || field.type === 'group_list') && (
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>子項目設定</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                このまとまりの中に入る項目を定義します。子項目のネストは1段までです。
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs py-1 px-3"
              onClick={() => onChange({
                ...field,
                options: serializeFieldOptions({ children: [...childFields, createChildTemplate(childFields.length)] }),
              })}
            >
              + 子項目追加
            </button>
          </div>
          {childFields.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              まだ子項目がありません。会場名や住所のような中身を追加してください。
            </div>
          ) : (
            <div className="space-y-3">
              {childFields.map((childField, childIndex) => (
                <ChildFieldTemplateRow
                  key={childField.id}
                  field={childField}
                  globalAssetObjects={globalAssetObjects}
                  onChange={(nextChild) => {
                    const nextChildren = [...childFields];
                    nextChildren[childIndex] = nextChild;
                    onChange({ ...field, options: serializeFieldOptions({ children: nextChildren }) });
                  }}
                  onRemove={() => {
                    const nextChildren = childFields.filter((_, currentIndex) => currentIndex !== childIndex);
                    onChange({ ...field, options: serializeFieldOptions({ children: nextChildren }) });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectTypesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [definitions, setDefinitions] = useState<ProjectTypeDefinition[]>(defaultProjectTypeDefinitions());
  const [globalAssetObjects, setGlobalAssetObjects] = useState<GlobalAssetObject[]>([]);
  const [contentTemplates, setContentTemplates] = useState<ProjectContentTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openDefinitionIds, setOpenDefinitionIds] = useState<string[]>([]);
  const [draggingPhase, setDraggingPhase] = useState<{ definitionId: string; index: number } | null>(null);
  const [draggingField, setDraggingField] = useState<{ definitionId: string; index: number } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }

    (async () => {
      const [projectTypesRes, globalAssetsRes, contentTemplatesRes] = await Promise.all([
        fetch(withBasePath('/api/project-types')),
        fetch(withBasePath('/api/global-assets')),
        fetch(withBasePath('/api/content-templates')),
      ]);
      const [projectTypesPayload, globalAssetsPayload, contentTemplatesPayload] = await Promise.all([
        projectTypesRes.json(),
        globalAssetsRes.json(),
        contentTemplatesRes.json(),
      ]);

      if (projectTypesRes.status === 401 || globalAssetsRes.status === 401 || contentTemplatesRes.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }

      setDefinitions(Array.isArray(projectTypesPayload.project_types) ? projectTypesPayload.project_types : defaultProjectTypeDefinitions());
      setGlobalAssetObjects(Array.isArray(globalAssetsPayload.objects) ? globalAssetsPayload.objects : []);
      setContentTemplates(Array.isArray(contentTemplatesPayload.content_templates) ? contentTemplatesPayload.content_templates : []);
      setOpenDefinitionIds((current) => current.length > 0 ? current : [projectTypesPayload.project_types?.[0]?.id || 'project-type-event']);
    })();
  }, [authLoading, user, router]);

  async function saveDefinitions(nextDefinitions = definitions) {
    setSaving(true);
    const res = await fetch(withBasePath('/api/project-types'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_types: nextDefinitions }),
    });
    const payload = await res.json();
    setSaving(false);

    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }

    setDefinitions(Array.isArray(payload.project_types) ? payload.project_types : nextDefinitions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateDefinition(index: number, nextDefinition: ProjectTypeDefinition) {
    setDefinitions((current) => {
      const next = [...current];
      next[index] = nextDefinition;
      return next;
    });
  }

  function addDefinition() {
    const nextDefinition = createProjectTypeDefinition({
        id: uuidv4(),
        key: `project_type_${definitions.length + 1}`,
      });
    setDefinitions((current) => [...current, nextDefinition]);
    setOpenDefinitionIds((current) => [...current, nextDefinition.id]);
  }

  function removeDefinition(index: number) {
    const definitionId = definitions[index]?.id;
    setDefinitions((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setOpenDefinitionIds((current) => current.filter((id) => id !== definitionId));
  }

  function toggleDefinition(definitionId: string) {
    setOpenDefinitionIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  if (authLoading) {
    return <div className="p-6 max-w-6xl mx-auto"><div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">プロジェクトオブジェクト設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            プロジェクト種別ごとの設定、進行フェーズ、初期項目テンプレートを管理します。
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={addDefinition} className="btn-secondary">+ 種別追加</button>
          <button onClick={() => saveDefinitions()} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">設定画面として運用できる構造</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              将来的にロール管理を入れる際も、この画面単位で「管理者のみ編集可」に切り替えやすい構成にしています。
            </p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.14)', color: 'rgb(196,181,253)' }}>
            settings-ready
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {definitions.map((definition, index) => (
          <section key={definition.id} className="card overflow-hidden">
            <button
              onClick={() => toggleDefinition(definition.id)}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{definition.name}</span>
                  {definition.is_default && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.14)', color: 'rgb(125,211,252)' }}>
                      default
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  key: {definition.key} ・ フェーズ {definition.phases.length}件 ・ 項目 {definition.field_templates.length}件
                </p>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {openDefinitionIds.includes(definition.id) ? '▲ 閉じる' : '▼ 開く'}
              </span>
            </button>

            {openDefinitionIds.includes(definition.id) && (
              <div className="p-5 space-y-5">
                <div className="rounded-md border p-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="section-title">種別設定</h2>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        名前、識別キー、説明を管理します。将来はここを管理者限定の設定面に切り替えられます。
                      </p>
                    </div>
                    <button onClick={() => removeDefinition(index)} className="btn-danger shrink-0">削除</button>
                  </div>
                  <div>
                    <label className="field-label">種別名</label>
                    <input className="field-input" value={definition.name} onChange={(e) => updateDefinition(index, { ...definition, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">キー</label>
                      <input className="field-input" value={definition.key} onChange={(e) => updateDefinition(index, { ...definition, key: e.target.value.replace(/\s+/g, '_') })} />
                    </div>
                    <div>
                      <label className="field-label">説明</label>
                      <input className="field-input" value={definition.description} onChange={(e) => updateDefinition(index, { ...definition, description: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="section-title">フェーズ設定</h2>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        この種別で使う進行ステップを並べます。詳細画面ではパスUIとして表示されます。
                      </p>
                    </div>
                    <button
                      onClick={() => updateDefinition(index, {
                        ...definition,
                        phases: [...definition.phases, { id: uuidv4(), key: `phase_${definition.phases.length + 1}`, name: `フェーズ ${definition.phases.length + 1}` }],
                      })}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      + フェーズ追加
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {definition.phases.map((phase, phaseIndex) => (
                      <div
                        key={phase.id}
                        className="px-3 py-2 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: phaseIndex === 0 ? 'rgba(16,185,129,0.14)' : 'rgba(99,102,241,0.14)',
                          color: phaseIndex === 0 ? 'rgb(110,231,183)' : 'rgb(196,181,253)',
                        }}
                      >
                        {phaseIndex + 1}. {phase.name}
                      </div>
                    ))}
                  </div>

                  {definition.phases.map((phase, phaseIndex) => (
                    <PhaseRow
                      key={phase.id}
                      phase={phase}
                      dragging={draggingPhase?.definitionId === definition.id && draggingPhase.index === phaseIndex}
                      onDragStart={() => setDraggingPhase({ definitionId: definition.id, index: phaseIndex })}
                      onDrop={() => {
                        if (!draggingPhase || draggingPhase.definitionId !== definition.id || draggingPhase.index === phaseIndex) return;
                        updateDefinition(index, { ...definition, phases: reorderList(definition.phases, draggingPhase.index, phaseIndex) });
                        setDraggingPhase(null);
                      }}
                      onChange={(nextPhase) => {
                        const phases = [...definition.phases];
                        phases[phaseIndex] = nextPhase;
                        updateDefinition(index, { ...definition, phases });
                      }}
                      onRemove={() => updateDefinition(index, { ...definition, phases: definition.phases.filter((_, currentPhaseIndex) => currentPhaseIndex !== phaseIndex) })}
                    />
                  ))}
                </div>

                <div className="rounded-md border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="section-title">項目設定</h2>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        プロジェクト作成時に自動で入る項目定義です。参照型では Global Assets のオブジェクトを指定できます。
                      </p>
                    </div>
                    <button
                      onClick={() => updateDefinition(index, {
                        ...definition,
                        field_templates: [...definition.field_templates, { id: uuidv4(), key: `field_${definition.field_templates.length + 1}`, label: `項目 ${definition.field_templates.length + 1}`, type: 'text', options: '{}', layout: 'half' }],
                      })}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      + 項目追加
                    </button>
                  </div>
                  {definition.field_templates.length === 0 ? (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>この種別に初期項目はありません。</div>
                  ) : (
                    definition.field_templates.map((field, fieldIndex) => (
                      <FieldTemplateRow
                        key={field.id}
                        field={field}
                        globalAssetObjects={globalAssetObjects}
                        dragging={draggingField?.definitionId === definition.id && draggingField.index === fieldIndex}
                        onDragStart={() => setDraggingField({ definitionId: definition.id, index: fieldIndex })}
                        onDrop={() => {
                          if (!draggingField || draggingField.definitionId !== definition.id || draggingField.index === fieldIndex) return;
                          updateDefinition(index, { ...definition, field_templates: reorderList(definition.field_templates, draggingField.index, fieldIndex) });
                          setDraggingField(null);
                        }}
                        onChange={(nextField) => {
                          const fieldTemplates = [...definition.field_templates];
                          fieldTemplates[fieldIndex] = nextField;
                          updateDefinition(index, { ...definition, field_templates: fieldTemplates });
                        }}
                        onRemove={() => updateDefinition(index, { ...definition, field_templates: definition.field_templates.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex) })}
                      />
                    ))
                  )}
                </div>

                <div className="rounded-md border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="section-title">生成コンテンツ設定</h2>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        この種別で使用する生成コンテンツを、別管理のコンテンツ設定から選択します。
                      </p>
                    </div>
                    <button onClick={() => router.push(withBasePath('/settings/content-templates'))} className="btn-secondary text-xs py-1 px-3">
                      ライブラリを開く
                    </button>
                  </div>
                  {contentTemplates.length === 0 ? (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>生成コンテンツ設定に登録された定義がありません。</div>
                  ) : (
                    contentTemplates.map((template) => (
                      <label key={template.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
                        <input
                          type="checkbox"
                          checked={definition.content_template_ids.includes(template.id)}
                          onChange={(e) => updateDefinition(index, {
                            ...definition,
                            content_template_ids: e.target.checked
                              ? [...definition.content_template_ids, template.id]
                              : definition.content_template_ids.filter((id) => id !== template.id),
                          })}
                          className="mt-1 accent-violet-500"
                        />
                        <div>
                          <p className="text-sm font-medium">{template.name}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{template.instruction}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
