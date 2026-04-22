'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { FieldLayout, GlobalAssetObject, ProjectContentTemplate, ProjectFieldTemplate, ProjectPhase, ProjectTypeDefinition, SectionDefinition, SectionFieldPlacement, SectionItemKind } from '@/types';
import { FIELD_TYPE_LABELS, SECTION_INFO_WIDGETS, WIDGET_FIELD_ID_PREFIX } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { createProjectTypeDefinition, defaultProjectTypeDefinitions, DEFAULT_SECTIONS } from '@/lib/project-types';
import {
  createStoredAIReferenceSettings,
  getProjectTypeAIReferenceOptions,
  normalizeSelectedAIReferenceKeys,
} from '@/lib/ai/reference-sources';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';

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

type PlacementDragState = {
  definitionId: string;
  source: 'palette' | 'section';
  fieldId: string;
  placementId?: string;
  sourceSectionId: string | null;
  sourceIndex: number;
};

type DefinitionPanelKey = 'basic' | 'phases' | 'sections' | 'fields' | 'ai_reference' | 'content';

function createSectionItem(fieldId: string, layout: FieldLayout = 'half', kind: SectionItemKind = 'field'): SectionFieldPlacement {
  return {
    id: uuidv4(),
    field_id: fieldId,
    layout,
    kind,
  };
}

/** 情報ウィジェット用の仮想 field_id を返す */
function widgetFieldId(kind: SectionItemKind): string {
  return `${WIDGET_FIELD_ID_PREFIX}${kind}`;
}

function ProjectAIReferenceChecklist({
  definition,
  globalAssetObjects,
  onChange,
}: {
  definition: ProjectTypeDefinition;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (settings: ProjectTypeDefinition['ai_reference']) => void;
}) {
  const options = getProjectTypeAIReferenceOptions(definition, globalAssetObjects);
  const availableKeys = options.map((option) => option.key);
  const selectedKeys = normalizeSelectedAIReferenceKeys(definition.ai_reference, availableKeys);
  const selectedSet = new Set(selectedKeys);
  const grouped = {
    base: options.filter((option) => option.group === 'base'),
    globalAssets: options.filter((option) => option.group === 'global_assets'),
    fields: options.filter((option) => option.group === 'fields'),
  };
  const sections: Array<[string, typeof grouped.base]> = [
    ['共通情報', grouped.base],
    ['マスターデータ', grouped.globalAssets],
    ['プロジェクト項目', grouped.fields],
  ];

  function updateSelection(key: string, checked: boolean) {
    const nextSelected = checked
      ? [...selectedKeys, key]
      : selectedKeys.filter((currentKey) => currentKey !== key);
    onChange(createStoredAIReferenceSettings(nextSelected, availableKeys));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        この種別でコンテンツを生成するとき、AIが参照してよい情報源を選択します。新しく追加された項目は自動でオンになります。
      </p>
      {sections
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => (
          <div key={label} className="space-y-2">
            <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            {items.map((option) => (
              <label key={option.key} className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.key)}
                  onChange={(e) => updateSelection(option.key, e.target.checked)}
                  className="mt-1 accent-violet-500"
                />
                <span>
                  <span className="font-medium">{option.label}</span>
                  <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        ))}
    </div>
  );
}

/** セクションに配置済みのフィールドIDセットを返す（情報ウィジェットは除外） */
function extractPlacedFieldIds(sections: SectionDefinition[]) {
  return new Set(
    sections.flatMap((section) =>
      section.items.filter((item) => (item.kind ?? 'field') === 'field').map((item) => item.field_id)
    )
  );
}

function addItemToSection(
  sections: SectionDefinition[],
  fieldId: string,
  targetSectionId: string,
  targetIndex?: number,
  fallbackLayout: FieldLayout = 'half',
  kind: SectionItemKind = 'field'
) {
  return sections.map((section) => {
    if (section.id !== targetSectionId) return section;
    // 同一セクション内での重複チェック（情報ウィジェットはセクション内1つまで、フィールドはグローバルで1つ）
    if (section.items.some((item) => item.field_id === fieldId)) return section;
    const nextItems = [...section.items];
    const insertAt = typeof targetIndex === 'number' ? Math.max(0, Math.min(targetIndex, nextItems.length)) : nextItems.length;
    nextItems.splice(insertAt, 0, createSectionItem(fieldId, fallbackLayout, kind));
    return { ...section, items: nextItems };
  });
}

/** 後方互換エイリアス */
function addFieldToSection(
  sections: SectionDefinition[],
  fieldId: string,
  targetSectionId: string,
  targetIndex?: number,
  fallbackLayout: FieldLayout = 'half'
) {
  return addItemToSection(sections, fieldId, targetSectionId, targetIndex, fallbackLayout, 'field');
}

function movePlacementBetweenSections(
  sections: SectionDefinition[],
  placementId: string,
  targetSectionId: string | null,
  targetIndex?: number
) {
  let movedItem: SectionFieldPlacement | null = null;
  let sourceSectionId: string | null = null;
  let sourceItemIndex = -1;

  // ドラッグ元のセクション・インデックスを記録
  sections.forEach((section) => {
    const idx = section.items.findIndex((item) => item.id === placementId);
    if (idx !== -1) {
      sourceSectionId = section.id;
      sourceItemIndex = idx;
    }
  });

  const cleanedSections = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.id !== placementId) return true;
      movedItem = item;
      return false;
    }),
  }));

  if (!targetSectionId || !movedItem) return cleanedSections;

  return cleanedSections.map((section) => {
    if (section.id !== targetSectionId) return section;
    const nextItems = [...section.items];
    let insertAt = typeof targetIndex === 'number' ? targetIndex : nextItems.length;
    // 同一セクション内の並び替え: ドラッグ元がターゲットより前にあった場合、
    // 要素削除後にインデックスが 1 ずれるため補正する
    if (sourceSectionId === targetSectionId && sourceItemIndex !== -1 && sourceItemIndex < insertAt) {
      insertAt -= 1;
    }
    insertAt = Math.max(0, Math.min(insertAt, nextItems.length));
    nextItems.splice(insertAt, 0, movedItem as SectionFieldPlacement);
    return { ...section, items: nextItems };
  });
}

function updateSectionItemLayout(sections: SectionDefinition[], sectionId: string, fieldId: string, layout: FieldLayout) {
  return sections.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      items: section.items.map((item) => item.field_id === fieldId ? { ...item, layout } : item),
    };
  });
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
              .filter(([type]) => !['group', 'group_list', 'list'].includes(type))
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

// プリセットカラー（カラーパレット）
const SECTION_COLOR_PRESETS = [
  '#0f9ab1', // アクセント青緑
  '#6366f1', // インディゴ
  '#10b981', // エメラルド
  '#f59e0b', // アンバー
  '#ef4444', // レッド
  '#8b5cf6', // バイオレット
  '#ec4899', // ピンク
  '#64748b', // スレート
];

function SectionRow({
  section,
  dragging,
  onDragStart,
  onDrop,
  onChange,
  onRemove,
}: {
  section: SectionDefinition;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onChange: (section: SectionDefinition) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`grid grid-cols-[28px_1fr_auto_80px] gap-2 items-center rounded-xl border p-3 ${dragging ? 'opacity-60' : ''}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.68)' }}
    >
      <div className="text-sm text-center cursor-grab select-none" style={{ color: 'var(--text-muted)' }}>⋮⋮</div>
      <div>
        <label className="field-label">セクション名</label>
        <div className="flex items-center gap-1.5">
          {/* カラーバー */}
          <span className="shrink-0 rounded" style={{ width: 4, height: 24, backgroundColor: section.color, display: 'inline-block' }} />
          <input className="field-input text-sm" value={section.name} onChange={(e) => onChange({ ...section, name: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="field-label">カラー</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {SECTION_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => onChange({ ...section, color })}
              className="rounded transition-all"
              style={{
                width: 20, height: 20,
                backgroundColor: color,
                outline: section.color === color ? `2px solid ${color}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          {/* カスタムカラーピッカー */}
          <label title="カスタムカラー" className="cursor-pointer rounded overflow-hidden flex items-center justify-center"
            style={{ width: 20, height: 20, border: '1.5px dashed var(--border)' }}>
            <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>+</span>
            <input type="color" className="sr-only" value={section.color} onChange={(e) => onChange({ ...section, color: e.target.value })} />
          </label>
        </div>
      </div>
      <button onClick={onRemove} className="btn-danger self-end">削除</button>
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
  onChange,
  onRemove,
}: {
  field: ProjectFieldTemplate;
  globalAssetObjects: GlobalAssetObject[];
  onChange: (field: ProjectFieldTemplate) => void;
  onRemove: () => void;
}) {
  const options = parseFieldOptions(field.options);
  const childFields = options.children ?? [];

  return (
    <div
      className="rounded-md border p-3 space-y-3"
      style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.68)' }}
    >
      <div className="grid grid-cols-[1.4fr_1fr_140px_80px] gap-2 items-end">
        <div>
          <label className="field-label">項目名</label>
          <div className="flex items-center gap-1.5">
            {field.is_builtin && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-semibold"
                style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)', border: '1px solid rgba(15,154,177,0.2)' }}>
                組込
              </span>
            )}
            <input className="field-input text-sm" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="field-label">キー</label>
          <input
            className="field-input text-sm"
            value={field.key}
            disabled={field.is_builtin}
            onChange={(e) => onChange({ ...field, key: e.target.value.replace(/\s+/g, '_') })}
            style={{ opacity: field.is_builtin ? 0.55 : 1 }}
          />
        </div>
        <div>
          <label className="field-label">種別</label>
          <select
            className="field-input text-sm"
            value={field.type}
            disabled={field.is_builtin}
            style={{ opacity: field.is_builtin ? 0.55 : 1 }}
            onChange={(e) => {
              const nextType = e.target.value as ProjectFieldTemplate['type'];
              const nextOptions = nextType === 'select'
                ? serializeFieldOptions({ choices: options.choices ?? [] })
                : nextType === 'reference' || nextType === 'reference_multi'
                  ? serializeFieldOptions({ referenceObjectId: options.referenceObjectId || '' })
                  : nextType === 'group' || nextType === 'group_list'
                    ? serializeFieldOptions({ children: options.children ?? [] })
                    : nextType === 'list'
                      ? serializeFieldOptions({ children: (options.children ?? []).slice(0, 1) })
                      : '{}';
              onChange({ ...field, type: nextType, options: nextOptions });
            }}
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
        {field.is_builtin
          ? <div className="flex items-end pb-0.5"><span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>削除不可</span></div>
          : <button onClick={onRemove} className="btn-danger">削除</button>
        }
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

      {field.type === 'list' && (
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>項目設定</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>繰り返しリストに入る項目の種別を1つ定義します。</p>
            </div>
            {childFields.length === 0 && (
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-3"
                onClick={() => onChange({ ...field, options: serializeFieldOptions({ children: [createChildTemplate(0)] }) })}
              >
                + 項目設定
              </button>
            )}
          </div>
          {childFields.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>まだ項目種別が設定されていません。</div>
          ) : (
            <ChildFieldTemplateRow
              field={childFields[0]}
              globalAssetObjects={globalAssetObjects}
              onChange={(nextChild) => onChange({ ...field, options: serializeFieldOptions({ children: [nextChild] }) })}
              onRemove={() => onChange({ ...field, options: serializeFieldOptions({ children: [] }) })}
            />
          )}
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

function PlacementChip({
  field,
  layout,
  color,
  attached,
  dragging,
  onDragStart,
  onDropBefore,
  onLayoutChange,
  onDragEnd,
  onRemove,
  supplementary,
  compact = false,
}: {
  field: ProjectFieldTemplate;
  layout: FieldLayout;
  color: string;
  attached: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDropBefore: () => void;
  onLayoutChange?: (layout: FieldLayout) => void;
  onDragEnd?: () => void;
  onRemove?: () => void;
  supplementary?: string;
  compact?: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); onDropBefore(); }}
      className={`rounded-xl border transition-all ${compact ? 'px-2.5 py-2' : 'p-3'} ${layout === 'full' ? 'col-span-2' : 'col-span-1'} ${dragging ? 'opacity-60 scale-[0.99]' : ''}`}
      style={{
        borderColor: attached ? `${color}66` : 'rgba(148,163,184,0.45)',
        backgroundColor: attached ? `${color}14` : 'rgba(148,163,184,0.12)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm cursor-grab select-none shrink-0" style={{ color: 'var(--text-muted)' }}>⋮⋮</span>
            <p className="text-sm font-medium truncate min-w-0" style={{ color: 'var(--text-primary)' }}>{field.label}</p>
            {!compact && field.is_builtin && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-semibold shrink-0"
                style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)', border: '1px solid rgba(15,154,177,0.2)' }}>
                組込
              </span>
            )}
          </div>
          {!compact && supplementary && (
            <p className="text-[0.6875rem] mt-2" style={{ color: 'var(--text-muted)' }}>
              {supplementary}
            </p>
          )}
          {compact && supplementary && (
            <p className="text-[0.625rem] mt-1" style={{ color: 'var(--text-muted)' }}>
              {supplementary}
            </p>
          )}
        </div>
        {!compact && onLayoutChange && (
          <div className="shrink-0 flex items-start gap-2">
            <div className="w-24">
              <select
                className="field-input text-xs w-full"
                value={layout}
                onChange={(e) => onLayoutChange(e.target.value as FieldLayout)}
              >
                <option value="half">2列</option>
                <option value="full">1列</option>
              </select>
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--danger)', backgroundColor: 'transparent', border: 'none' }}
                title="このセクションから外す"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 情報ウィジェット種別ごとのアイコンとカラー */
const INFO_WIDGET_STYLE: Record<string, { icon: string; color: string }> = {
  project_type: { icon: '🏷', color: '#8b5cf6' },
  phase: { icon: '→', color: '#f59e0b' },
  note_list: { icon: '📌', color: '#64748b' },
  todo_list: { icon: '✓', color: '#3b82f6' },
  todo_summary: { icon: '◉', color: '#10b981' },
  member_list: { icon: '👥', color: '#0ea5e9' },
};

function InfoWidgetChip({
  kind,
  label,
  description,
  layout,
  color,
  dragging,
  onDragStart,
  onDropBefore,
  onDragEnd,
  onRemove,
  onLayoutChange,
  compact = false,
}: {
  kind: SectionItemKind;
  label: string;
  description: string;
  layout: FieldLayout;
  color: string;
  dragging: boolean;
  onDragStart: () => void;
  onDropBefore: () => void;
  onDragEnd?: () => void;
  onRemove?: () => void;
  onLayoutChange?: (layout: FieldLayout) => void;
  compact?: boolean;
}) {
  const style = INFO_WIDGET_STYLE[kind] ?? { icon: '◈', color: '#64748b' };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); onDropBefore(); }}
      className={`rounded-xl border transition-all ${compact ? 'px-2.5 py-2' : 'p-3'} ${layout === 'full' ? 'col-span-2' : 'col-span-1'} ${dragging ? 'opacity-60 scale-[0.99]' : ''}`}
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}12`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm cursor-grab select-none shrink-0" style={{ color: 'var(--text-muted)' }}>⋮⋮</span>
            <span className="text-sm shrink-0" style={{ color: style.color }}>{style.icon}</span>
            <p className="text-sm font-medium truncate min-w-0" style={{ color: 'var(--text-primary)' }}>{label}</p>
            {!compact && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-semibold shrink-0"
                style={{ backgroundColor: `${style.color}18`, color: style.color, border: `1px solid ${style.color}44` }}
              >
                情報
              </span>
            )}
          </div>
          {!compact && description && (
            <p className="text-[0.6875rem] mt-2" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
          {compact && description && (
            <p className="text-[0.625rem] mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        {!compact && onLayoutChange && (
          <div className="shrink-0 flex items-start gap-2">
            <div className="w-24">
              <select
                className="field-input text-xs w-full"
                value={layout}
                onChange={(e) => onLayoutChange(e.target.value as FieldLayout)}
              >
                <option value="half">2列</option>
                <option value="full">1列</option>
              </select>
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--danger)', backgroundColor: 'transparent', border: 'none' }}
                title="このセクションから外す"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionPlacementPanel({
  section,
  fields,
  draggingPlacement,
  draggingSection,
  onDropToSection,
  onDropBeforeItem,
  onRemoveItem,
  onDragStart,
  onDragEnd,
  onLayoutChange,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDrop,
  onSectionChange,
  onSectionRemove,
}: {
  section: SectionDefinition;
  fields: ProjectFieldTemplate[];
  draggingPlacement: PlacementDragState | null;
  draggingSection: boolean;
  onDropToSection: () => void;
  onDropBeforeItem: (index: number) => void;
  onRemoveItem: (placementId: string) => void;
  onDragStart: (fieldId: string, sourceIndex: number, placementId: string) => void;
  onDragEnd: () => void;
  onLayoutChange: (fieldId: string, layout: FieldLayout) => void;
  onSectionDragStart: () => void;
  onSectionDragEnd: () => void;
  onSectionDrop: () => void;
  onSectionChange: (section: SectionDefinition) => void;
  onSectionRemove: () => void;
}) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));

  return (
    <div
      draggable
      onDragStart={onSectionDragStart}
      onDragEnd={onSectionDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onSectionDrop();
      }}
      className={`rounded-xl border p-4 space-y-3 min-h-32 ${draggingSection ? 'opacity-60' : ''}`}
      style={{ borderColor: `${section.color}55`, backgroundColor: `${section.color}10` }}
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: `${section.color}33` }}>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-center cursor-grab select-none shrink-0" style={{ color: 'var(--text-muted)' }}>⋮⋮</span>
            <span className="inline-block rounded-full shrink-0" style={{ width: 10, height: 10, backgroundColor: section.color }} />
            <input
              className="field-input text-sm py-1.5"
              value={section.name}
              onChange={(e) => onSectionChange({ ...section, name: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSectionChange({ ...section, defaultOpen: !(section.defaultOpen ?? true) })}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.6875rem] font-medium transition-colors shrink-0"
              style={{
                backgroundColor: (section.defaultOpen ?? true) ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.08)',
                color: (section.defaultOpen ?? true) ? '#10b981' : '#94a3b8',
                border: `1px solid ${(section.defaultOpen ?? true) ? '#10b981' : '#cbd5e1'}55`,
              }}
              title="プロジェクト詳細ページを開いたときのデフォルト表示状態"
            >
              <span>{(section.defaultOpen ?? true) ? '▼' : '▶'}</span>
              <span>初期{(section.defaultOpen ?? true) ? '展開' : '折りたたみ'}</span>
            </button>
            <div className="flex flex-wrap justify-end gap-1.5">
              {SECTION_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  onClick={() => onSectionChange({ ...section, color: preset })}
                  className="rounded transition-all shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: preset,
                    outline: section.color === preset ? `2px solid ${preset}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
              <label
                title="カスタムカラー"
                className="cursor-pointer rounded overflow-hidden flex items-center justify-center shrink-0"
                style={{ width: 18, height: 18, border: '1.5px dashed var(--border)' }}
              >
                <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>+</span>
                <input type="color" className="sr-only" value={section.color} onChange={(e) => onSectionChange({ ...section, color: e.target.value })} />
              </label>
            </div>
          </div>
        </div>
        <button type="button" onClick={onSectionRemove} className="btn-danger shrink-0">削除</button>
      </div>

      {section.items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed px-3 py-6 text-center text-xs"
          style={{ borderColor: `${section.color}66`, color: 'var(--text-muted)' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropToSection();
          }}
        >
          項目をここへドロップ
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropToSection();
          }}
        >
          {section.items.map((item, itemIndex) => {
            const itemKind = item.kind ?? 'field';

            if (itemKind !== 'field') {
              const widgetDef = SECTION_INFO_WIDGETS.find((w) => w.kind === itemKind);
              if (!widgetDef) return null;
              return (
                <InfoWidgetChip
                  key={item.id}
                  kind={itemKind}
                  label={widgetDef.label}
                  description={widgetDef.description}
                  layout={item.layout}
                  color={section.color}
                  dragging={draggingPlacement?.source === 'section' && draggingPlacement.placementId === item.id}
                  onDragStart={() => onDragStart(item.field_id, itemIndex, item.id)}
                  onDragEnd={onDragEnd}
                  onDropBefore={() => onDropBeforeItem(itemIndex)}
                  onLayoutChange={(layout) => onLayoutChange(item.field_id, layout)}
                  onRemove={() => onRemoveItem(item.id)}
                />
              );
            }

            const field = fieldMap.get(item.field_id);
            if (!field) return null;
            return (
              <PlacementChip
                key={item.id}
                field={field}
                layout={item.layout}
                color={section.color}
                attached
                dragging={draggingPlacement?.source === 'section' && draggingPlacement.placementId === item.id}
                onDragStart={() => onDragStart(field.id, itemIndex, item.id)}
                onDragEnd={onDragEnd}
                onDropBefore={() => onDropBeforeItem(itemIndex)}
                onLayoutChange={(layout) => onLayoutChange(field.id, layout)}
                onRemove={() => onRemoveItem(item.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DefinitionAccordionSection({
  title,
  description,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="row-hover w-full p-4 flex items-center justify-between gap-4 text-left rounded-md"
      >
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
          {open ? '▲ 閉じる' : '▼ 開く'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {action && <div className="pt-4 flex justify-end">{action}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProjectTypesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageProjectSettings = Boolean(user?.system_permissions?.manage_project_settings);
  const [definitions, setDefinitions] = useState<ProjectTypeDefinition[]>(defaultProjectTypeDefinitions());
  const [globalAssetObjects, setGlobalAssetObjects] = useState<GlobalAssetObject[]>([]);
  const [contentTemplates, setContentTemplates] = useState<ProjectContentTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openDefinitionIds, setOpenDefinitionIds] = useState<string[]>([]);
  const [openDefinitionPanels, setOpenDefinitionPanels] = useState<Record<string, DefinitionPanelKey[]>>({});
  const [openSectionGuideIds, setOpenSectionGuideIds] = useState<string[]>([]);
  const [openAssignedFieldPaletteIds, setOpenAssignedFieldPaletteIds] = useState<string[]>([]);
  const [openAssignedWidgetPaletteIds, setOpenAssignedWidgetPaletteIds] = useState<string[]>([]);
  const [openBuiltinFieldDefinitionIds, setOpenBuiltinFieldDefinitionIds] = useState<string[]>([]);
  const [closedCustomFieldDefinitionIds, setClosedCustomFieldDefinitionIds] = useState<string[]>([]);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const [draggingPhase, setDraggingPhase] = useState<{ definitionId: string; index: number } | null>(null);
  const [draggingSection, setDraggingSection] = useState<{ definitionId: string; index: number } | null>(null);
  const [draggingPlacement, setDraggingPlacement] = useState<PlacementDragState | null>(null);
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
      const [projectTypesRes, globalAssetsRes, contentTemplatesRes] = await Promise.all([
        fetch(withBasePath('/api/project-types')),
        fetch(withBasePath('/api/master-data')),
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
      if (projectTypesRes.status === 403 || globalAssetsRes.status === 403 || contentTemplatesRes.status === 403) {
        router.push(withBasePath('/settings'));
        return;
      }
      if (!projectTypesRes.ok || !globalAssetsRes.ok || !contentTemplatesRes.ok) {
        return;
      }

      setDefinitions(Array.isArray(projectTypesPayload.project_types) ? projectTypesPayload.project_types : defaultProjectTypeDefinitions());
      setGlobalAssetObjects(Array.isArray(globalAssetsPayload.objects) ? globalAssetsPayload.objects : []);
      setContentTemplates(Array.isArray(contentTemplatesPayload.content_templates) ? contentTemplatesPayload.content_templates : []);
      setOpenDefinitionIds((current) => current.length > 0 ? current : []);
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
    if (res.status === 403) {
      router.push(withBasePath('/settings'));
      return;
    }
    if (!res.ok) {
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
    setOpenDefinitionPanels((current) => ({ ...current, [nextDefinition.id]: ['basic'] }));
    setPendingScrollTarget(`project-type-definition-${nextDefinition.id}`);
  }

  function removeDefinition(index: number) {
    const definitionId = definitions[index]?.id;
    setDefinitions((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setOpenDefinitionIds((current) => current.filter((id) => id !== definitionId));
    setOpenDefinitionPanels((current) => {
      const next = { ...current };
      if (definitionId) delete next[definitionId];
      return next;
    });
  }

  function toggleDefinition(definitionId: string) {
    setOpenDefinitionIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function toggleDefinitionPanel(definitionId: string, panel: DefinitionPanelKey) {
    setOpenDefinitionPanels((current) => {
      const currentPanels = current[definitionId] ?? [];
      return {
        ...current,
        [definitionId]: currentPanels.includes(panel)
          ? currentPanels.filter((item) => item !== panel)
          : [...currentPanels, panel],
      };
    });
  }

  function toggleSectionGuide(definitionId: string) {
    setOpenSectionGuideIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function toggleAssignedFieldPalette(definitionId: string) {
    setOpenAssignedFieldPaletteIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function toggleAssignedWidgetPalette(definitionId: string) {
    setOpenAssignedWidgetPaletteIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function toggleBuiltinFields(definitionId: string) {
    setOpenBuiltinFieldDefinitionIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function toggleCustomFields(definitionId: string) {
    setClosedCustomFieldDefinitionIds((current) =>
      current.includes(definitionId)
        ? current.filter((id) => id !== definitionId)
        : [...current, definitionId]
    );
  }

  function updateFieldTemplatesAndSections(
    definition: ProjectTypeDefinition,
    nextFieldTemplates: ProjectFieldTemplate[],
    nextSections?: SectionDefinition[]
  ) {
    const validFieldIds = new Set(nextFieldTemplates.map((field) => field.id));
    const sanitizedSections = (nextSections ?? definition.sections).map((section) => ({
      ...section,
      // 情報ウィジェット（kind !== 'field'）はフィールドIDチェックを除外して保持
      items: section.items.filter((item) => (item.kind ?? 'field') !== 'field' || validFieldIds.has(item.field_id)),
    }));

    return {
      ...definition,
      field_templates: nextFieldTemplates,
      sections: sanitizedSections,
    };
  }

  usePendingScrollTarget(
    pendingScrollTarget,
    [definitions, openDefinitionIds, openDefinitionPanels],
    setPendingScrollTarget,
    scrollOptions,
  );

  useRegisterShortcutScope('project-types', 'プロジェクト設定', {
    save_current: canManageProjectSettings ? () => saveDefinitions() : undefined,
    new_record: canManageProjectSettings ? addDefinition : undefined,
  });

  if (authLoading) {
    return <div className="p-6 max-w-6xl mx-auto"><div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div></div>;
  }

  if (!user || !canManageProjectSettings) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">プロジェクト設定</h1>
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
          <span className="text-[0.6875rem] px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.14)', color: 'rgb(196,181,253)' }}>
            settings-ready
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {definitions.map((definition, index) => (
          <section key={definition.id} id={`project-type-definition-${definition.id}`} className="card overflow-hidden">
            <button
              onClick={() => toggleDefinition(definition.id)}
              className="row-hover w-full px-5 py-4 flex items-center justify-between gap-4 text-left border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{definition.name}</span>
                  {definition.is_default && (
                    <span className="text-[0.6875rem] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.14)', color: 'rgb(125,211,252)' }}>
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
                <DefinitionAccordionSection
                  title="種別設定"
                  description="名前、識別キー、説明を管理します。将来はここを管理者限定の設定面に切り替えられます。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('basic')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'basic')}
                  action={<button onClick={() => removeDefinition(index)} className="btn-danger shrink-0">削除</button>}
                >
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
                </DefinitionAccordionSection>

                <DefinitionAccordionSection
                  title="フェーズ設定"
                  description="この種別で使う進行ステップを並べます。詳細画面ではパスUIとして表示されます。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('phases')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'phases')}
                  action={
                    <button
                      onClick={() => {
                        const nextPhaseId = uuidv4();
                        updateDefinition(index, {
                          ...definition,
                          phases: [...definition.phases, { id: nextPhaseId, key: `phase_${definition.phases.length + 1}`, name: `フェーズ ${definition.phases.length + 1}` }],
                        });
                        setPendingScrollTarget(`project-type-phase-${nextPhaseId}`);
                      }}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      + フェーズ追加
                    </button>
                  }
                >
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
                    <div key={phase.id} id={`project-type-phase-${phase.id}`}>
                      <PhaseRow
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
                    </div>
                  ))}
                </DefinitionAccordionSection>

                <DefinitionAccordionSection
                  title="セクション定義"
                  description="UI上の見せ方はここで管理します。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('sections')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'sections')}
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSectionGuide(definition.id)}
                        className="btn-secondary text-xs py-1 px-2"
                        title="使い方を表示"
                      >
                        ?
                      </button>
                      <button
                        onClick={() => {
                          const colorIndex = (definition.sections ?? []).length % SECTION_COLOR_PRESETS.length;
                          const nextSectionId = uuidv4();
                          updateDefinition(index, {
                            ...definition,
                            sections: [...(definition.sections ?? []), { id: nextSectionId, name: `セクション ${(definition.sections ?? []).length + 1}`, color: SECTION_COLOR_PRESETS[colorIndex], items: [] }],
                          });
                          setPendingScrollTarget(`project-type-section-${nextSectionId}`);
                        }}
                        className="btn-secondary text-xs py-1 px-3"
                      >
                        + セクション追加
                      </button>
                    </div>
                  }
                >
                  {(() => {
                    const placedFieldIds = extractPlacedFieldIds(definition.sections ?? []);
                    const unassignedFields = definition.field_templates.filter((field) => !placedFieldIds.has(field.id));
                    const assignedFields = definition.field_templates.filter((field) => placedFieldIds.has(field.id));

                    // 情報パレット: 配置済みウィジェット種別を収集
                    const placedWidgetKinds = new Set(
                      (definition.sections ?? []).flatMap((s) =>
                        s.items.filter((item) => (item.kind ?? 'field') !== 'field').map((item) => item.kind as string)
                      )
                    );
                    const unplacedWidgets = SECTION_INFO_WIDGETS.filter((w) => !placedWidgetKinds.has(w.kind));
                    const placedWidgets = SECTION_INFO_WIDGETS.filter((w) => placedWidgetKinds.has(w.kind));

                    return (
                      <>
                        {openSectionGuideIds.includes(definition.id) && (
                          <div className="rounded-xl border px-4 py-3 text-xs" style={{ borderColor: 'rgba(15,154,177,0.18)', backgroundColor: 'rgba(15,154,177,0.06)', color: 'var(--text-secondary)' }}>
                            右の項目パレットから左のセクションへドラッグすると追加されます。左の配置済み項目を別セクションへドラッグすると移動します。
                          </div>
                        )}
                        {(definition.sections ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(definition.sections ?? []).map((sec) => (
                              <div key={sec.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                                style={{ backgroundColor: `${sec.color}18`, border: `1px solid ${sec.color}44`, color: sec.color }}>
                                <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: sec.color }} />
                                {sec.name}
                              </div>
                            ))}
                          </div>
                        )}
                        {(definition.sections ?? []).length === 0 ? (
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            セクションがありません。追加すると配置UIを構成できます。
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                              <div className="space-y-3">
                                {(definition.sections ?? []).map((sec, secIndex) => (
                                  <div key={`${sec.id}-placement`} id={`project-type-section-${sec.id}`}>
                                    <SectionPlacementPanel
                                      section={sec}
                                      fields={definition.field_templates}
                                      draggingPlacement={draggingPlacement}
                                      draggingSection={draggingSection?.definitionId === definition.id && draggingSection.index === secIndex}
                                      onDropToSection={() => {
                                        if (!draggingPlacement || draggingPlacement.definitionId !== definition.id) return;
                                        if (draggingPlacement.source === 'palette') {
                                          const isWidget = draggingPlacement.fieldId.startsWith(WIDGET_FIELD_ID_PREFIX);
                                          const widgetKind = isWidget
                                            ? (draggingPlacement.fieldId.slice(WIDGET_FIELD_ID_PREFIX.length) as SectionItemKind)
                                            : 'field';
                                          const draggedField = definition.field_templates.find((field) => field.id === draggingPlacement.fieldId);
                                          updateDefinition(index, {
                                            ...definition,
                                            sections: addItemToSection(definition.sections, draggingPlacement.fieldId, sec.id, undefined, draggedField?.layout || 'half', widgetKind),
                                          });
                                        } else {
                                          updateDefinition(index, {
                                            ...definition,
                                            sections: movePlacementBetweenSections(definition.sections, draggingPlacement.placementId!, sec.id, undefined),
                                          });
                                        }
                                        setDraggingPlacement(null);
                                      }}
                                      onDropBeforeItem={(itemIndex) => {
                                        if (!draggingPlacement || draggingPlacement.definitionId !== definition.id) return;
                                        if (draggingPlacement.source === 'palette') {
                                          const isWidget = draggingPlacement.fieldId.startsWith(WIDGET_FIELD_ID_PREFIX);
                                          const widgetKind = isWidget
                                            ? (draggingPlacement.fieldId.slice(WIDGET_FIELD_ID_PREFIX.length) as SectionItemKind)
                                            : 'field';
                                          const draggedField = definition.field_templates.find((field) => field.id === draggingPlacement.fieldId);
                                          updateDefinition(index, {
                                            ...definition,
                                            sections: addItemToSection(definition.sections, draggingPlacement.fieldId, sec.id, itemIndex, draggedField?.layout || 'half', widgetKind),
                                          });
                                        } else {
                                          updateDefinition(index, {
                                            ...definition,
                                            sections: movePlacementBetweenSections(definition.sections, draggingPlacement.placementId!, sec.id, itemIndex),
                                          });
                                        }
                                        setDraggingPlacement(null);
                                      }}
                                      onRemoveItem={(placementId) => {
                                        updateDefinition(index, {
                                          ...definition,
                                          sections: movePlacementBetweenSections(definition.sections, placementId, null),
                                        });
                                        setDraggingPlacement(null);
                                      }}
                                      onDragStart={(fieldId, sourceIndex, placementId) => setDraggingPlacement({
                                        definitionId: definition.id,
                                        source: 'section',
                                        fieldId,
                                        placementId,
                                        sourceSectionId: sec.id,
                                        sourceIndex,
                                      })}
                                      onDragEnd={() => setDraggingPlacement(null)}
                                      onLayoutChange={(fieldId, layout) => updateDefinition(index, {
                                        ...definition,
                                        sections: updateSectionItemLayout(definition.sections, sec.id, fieldId, layout),
                                      })}
                                      onSectionDragStart={() => setDraggingSection({ definitionId: definition.id, index: secIndex })}
                                      onSectionDragEnd={() => setDraggingSection(null)}
                                      onSectionDrop={() => {
                                        if (!draggingSection || draggingSection.definitionId !== definition.id || draggingSection.index === secIndex) return;
                                        updateDefinition(index, { ...definition, sections: reorderList(definition.sections ?? [], draggingSection.index, secIndex) });
                                        setDraggingSection(null);
                                      }}
                                      onSectionChange={(nextSec) => {
                                        const sections = [...(definition.sections ?? [])];
                                        sections[secIndex] = nextSec;
                                        updateDefinition(index, { ...definition, sections });
                                      }}
                                      onSectionRemove={() => updateDefinition(index, { ...definition, sections: (definition.sections ?? []).filter((_, i) => i !== secIndex) })}
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="lg:border-l lg:pl-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                                <div
                                  className="rounded-xl border overflow-hidden"
                                  style={{ borderColor: 'rgba(148,163,184,0.3)', backgroundColor: 'rgba(248,251,253,0.85)' }}
                                >
                                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>項目パレット</p>
                                  </div>

                                  <div className="px-4 py-3 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>未配置項目</p>
                                      <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>{unassignedFields.length} 件</span>
                                    </div>
                                    {unassignedFields.length === 0 ? (
                                      <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: 'rgba(148,163,184,0.28)', color: 'var(--text-muted)' }}>
                                        未配置なし
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {unassignedFields.map((field) => (
                                          <PlacementChip
                                            key={field.id}
                                            field={field}
                                            layout={field.layout || 'half'}
                                            color="#94a3b8"
                                          attached={false}
                                          compact
                                          dragging={draggingPlacement?.source === 'palette' && draggingPlacement.fieldId === field.id}
                                          onDragStart={() => setDraggingPlacement({
                                            definitionId: definition.id,
                                              source: 'palette',
                                              fieldId: field.id,
                                            sourceSectionId: null,
                                            sourceIndex: -1,
                                          })}
                                          onDragEnd={() => setDraggingPlacement(null)}
                                          onDropBefore={() => {}}
                                        />
                                      ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleAssignedFieldPalette(definition.id)}
                                      className="w-full flex items-center justify-between gap-3 text-left"
                                    >
                                      <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>配置済み項目</p>
                                      <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                                        {openAssignedFieldPaletteIds.includes(definition.id) ? '▲' : '▼'}
                                      </span>
                                    </button>
                                    {openAssignedFieldPaletteIds.includes(definition.id) && (
                                      assignedFields.length === 0 ? (
                                        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: 'rgba(148,163,184,0.28)', color: 'var(--text-muted)' }}>
                                          配置済みなし
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {assignedFields.map((field) => (
                                            <PlacementChip
                                              key={`${field.id}-assigned`}
                                              field={field}
                                              layout={field.layout || 'half'}
                                              color="#0f9ab1"
                                              attached={false}
                                              compact
                                              dragging={draggingPlacement?.source === 'palette' && draggingPlacement.fieldId === field.id}
                                              onDragStart={() => setDraggingPlacement({
                                                definitionId: definition.id,
                                                source: 'palette',
                                                fieldId: field.id,
                                                sourceSectionId: null,
                                                sourceIndex: -1,
                                              })}
                                              onDragEnd={() => setDraggingPlacement(null)}
                                              onDropBefore={() => {}}
                                            />
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>

                                </div>

                                {/* 情報パレット独立ボックス */}
                                <div
                                  className="rounded-xl border overflow-hidden"
                                  style={{ borderColor: 'rgba(148,163,184,0.3)', backgroundColor: 'rgba(248,251,253,0.85)' }}
                                >
                                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>情報パレット</p>
                                  </div>

                                  <div className="px-4 py-3 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>未配置</p>
                                      <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>{unplacedWidgets.length} 件</span>
                                    </div>
                                    {unplacedWidgets.length === 0 ? (
                                      <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: 'rgba(148,163,184,0.28)', color: 'var(--text-muted)' }}>
                                        未配置なし
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {unplacedWidgets.map((widget) => (
                                          <InfoWidgetChip
                                            key={widget.kind}
                                            kind={widget.kind}
                                            label={widget.label}
                                            description={widget.description}
                                            layout="half"
                                            color={(INFO_WIDGET_STYLE[widget.kind] ?? { color: '#64748b' }).color}
                                            compact
                                            dragging={draggingPlacement?.source === 'palette' && draggingPlacement.fieldId === widgetFieldId(widget.kind)}
                                            onDragStart={() => setDraggingPlacement({
                                              definitionId: definition.id,
                                              source: 'palette',
                                              fieldId: widgetFieldId(widget.kind),
                                              sourceSectionId: null,
                                              sourceIndex: -1,
                                            })}
                                            onDragEnd={() => setDraggingPlacement(null)}
                                            onDropBefore={() => {}}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleAssignedWidgetPalette(definition.id)}
                                      className="w-full flex items-center justify-between gap-3 text-left"
                                    >
                                      <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>配置済み</p>
                                      <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
                                        {openAssignedWidgetPaletteIds.includes(definition.id) ? '▲' : '▼'}
                                      </span>
                                    </button>
                                    {openAssignedWidgetPaletteIds.includes(definition.id) && (
                                      placedWidgets.length === 0 ? (
                                        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: 'rgba(148,163,184,0.28)', color: 'var(--text-muted)' }}>
                                          配置済みなし
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {placedWidgets.map((widget) => (
                                            <InfoWidgetChip
                                              key={`${widget.kind}-placed`}
                                              kind={widget.kind}
                                              label={widget.label}
                                              description={widget.description}
                                              layout="half"
                                              color={(INFO_WIDGET_STYLE[widget.kind] ?? { color: '#64748b' }).color}
                                              compact
                                              dragging={draggingPlacement?.source === 'palette' && draggingPlacement.fieldId === widgetFieldId(widget.kind)}
                                              onDragStart={() => setDraggingPlacement({
                                                definitionId: definition.id,
                                                source: 'palette',
                                                fieldId: widgetFieldId(widget.kind),
                                                sourceSectionId: null,
                                                sourceIndex: -1,
                                              })}
                                              onDragEnd={() => setDraggingPlacement(null)}
                                              onDropBefore={() => {}}
                                            />
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </DefinitionAccordionSection>

                <DefinitionAccordionSection
                  title="項目設定"
                  description="「組み込み」は全プロジェクト共通の基本項目です。ここでは項目の情報だけを編集します。UI上の配置はセクション設定で行います。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('fields')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'fields')}
                  action={
                    <button
                      onClick={() => {
                        const nextField = { id: uuidv4(), key: `field_${definition.field_templates.length + 1}`, label: `項目 ${definition.field_templates.length + 1}`, type: 'text', options: '{}', layout: 'half', section: '' } as ProjectFieldTemplate;
                        updateDefinition(index, {
                          ...updateFieldTemplatesAndSections(definition, [
                            ...definition.field_templates,
                            nextField,
                          ]),
                        });
                        setClosedCustomFieldDefinitionIds((current) => current.filter((id) => id !== definition.id));
                        setPendingScrollTarget(`field-row-${definition.id}-${nextField.id}`);
                      }}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      + 項目追加
                    </button>
                  }
                >
                  {definition.field_templates.length === 0 ? (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>この種別に初期項目はありません。</div>
                  ) : (
                    (() => {
                      const builtinFields = definition.field_templates.filter((field) => field.is_builtin);
                      const customFields = definition.field_templates.filter((field) => !field.is_builtin);
                      const customFieldsOpen = !closedCustomFieldDefinitionIds.includes(definition.id);

                      return (
                        <div className="space-y-4">
                          <div className="border-y" style={{ borderColor: 'var(--border)' }}>
                            <button
                              type="button"
                              onClick={() => toggleBuiltinFields(definition.id)}
                              className="w-full py-3 flex items-center justify-between gap-3 text-left"
                            >
                              <p className="text-sm font-semibold">組み込み項目</p>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {openBuiltinFieldDefinitionIds.includes(definition.id) ? '▲ 閉じる' : `▼ ${builtinFields.length}件`}
                              </span>
                            </button>
                            {openBuiltinFieldDefinitionIds.includes(definition.id) && (
                              <div className="py-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                {builtinFields.map((field) => {
                                  const fieldIndex = definition.field_templates.findIndex((currentField) => currentField.id === field.id);
                                  return (
                                    <div key={field.id} id={`field-row-${definition.id}-${field.id}`}>
                                      <FieldTemplateRow
                                        field={field}
                                        globalAssetObjects={globalAssetObjects}
                                        onChange={(nextField) => {
                                          const fieldTemplates = [...definition.field_templates];
                                          fieldTemplates[fieldIndex] = nextField;
                                          updateDefinition(index, updateFieldTemplatesAndSections(definition, fieldTemplates));
                                        }}
                                        onRemove={() => {}}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="border-y" style={{ borderColor: 'var(--border)' }}>
                            <button
                              type="button"
                              onClick={() => toggleCustomFields(definition.id)}
                              className="w-full py-3 flex items-center justify-between gap-3 text-left"
                            >
                              <p className="text-sm font-semibold">カスタム項目</p>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {customFieldsOpen ? '▲ 閉じる' : `▼ ${customFields.length}件`}
                              </span>
                            </button>
                            {customFieldsOpen && (
                              <div className="py-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                {customFields.length === 0 ? (
                                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    カスタム項目はありません。+ 項目追加から追加できます。
                                  </p>
                                ) : (
                                  customFields.map((field) => {
                                    const fieldIndex = definition.field_templates.findIndex((currentField) => currentField.id === field.id);
                                    return (
                                      <div key={field.id} id={`field-row-${definition.id}-${field.id}`}>
                                        <FieldTemplateRow
                                          field={field}
                                          globalAssetObjects={globalAssetObjects}
                                          onChange={(nextField) => {
                                            const fieldTemplates = [...definition.field_templates];
                                            fieldTemplates[fieldIndex] = nextField;
                                            updateDefinition(index, updateFieldTemplatesAndSections(definition, fieldTemplates));
                                          }}
                                          onRemove={() => updateDefinition(index, updateFieldTemplatesAndSections(
                                            definition,
                                            definition.field_templates.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex)
                                          ))}
                                        />
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </DefinitionAccordionSection>

                <DefinitionAccordionSection
                  title="AI参照設定"
                  description="この種別でコンテンツを生成するとき、AIが参照する情報源を設定します。全コンテンツテンプレートに共通で適用されます。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('ai_reference')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'ai_reference')}
                >
                  <ProjectAIReferenceChecklist
                    definition={definition}
                    globalAssetObjects={globalAssetObjects}
                    onChange={(nextAIReference) => updateDefinition(index, {
                      ...definition,
                      ai_reference: nextAIReference,
                    })}
                  />
                </DefinitionAccordionSection>

                <DefinitionAccordionSection
                  title="生成コンテンツ設定"
                  description="この種別で使用する生成コンテンツを、別管理のコンテンツ設定から選択します。"
                  open={(openDefinitionPanels[definition.id] ?? []).includes('content')}
                  onToggle={() => toggleDefinitionPanel(definition.id, 'content')}
                  action={<button onClick={() => router.push(withBasePath('/settings/content-templates'))} className="btn-secondary text-xs py-1 px-3">ライブラリを開く</button>}
                >
                  {contentTemplates.length === 0 ? (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>生成コンテンツ設定に登録された定義がありません。</div>
                  ) : (
                    contentTemplates.map((template) => (
                      <label key={template.id} className="row-hover flex items-start gap-3 rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                        <input
                          type="checkbox"
                          checked={definition.content_template_ids.includes(template.id)}
                          onChange={(e) => updateDefinition(index, {
                            ...definition,
                            content_template_ids: e.target.checked
                              ? [...definition.content_template_ids, template.id]
                              : definition.content_template_ids.filter((id) => id !== template.id),
                          })}
                          className="mt-1 accent-violet-500 shrink-0"
                        />
                        <div>
                          <p className="text-sm font-medium">{template.name}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{template.instruction}</p>
                        </div>
                      </label>
                    ))
                  )}
                </DefinitionAccordionSection>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
