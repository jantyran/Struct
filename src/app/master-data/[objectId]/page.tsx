'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { GlobalAssets, GlobalAssetField, GlobalAssetFieldType, GlobalAssetObject } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { defaultGlobalAssetObjects, normalizeGlobalAssets } from '@/lib/global-assets';

function parseFieldOptions(options?: string) {
  try {
    const parsed = JSON.parse(options || '{}');
    return parsed && typeof parsed === 'object'
      ? parsed as { referenceObjectId?: string }
      : {};
  } catch {
    return {};
  }
}

const EMPTY_GA: GlobalAssets = {
  objects: defaultGlobalAssetObjects(),
  updated_at: '',
};

const FIELD_TYPE_LABELS: Record<GlobalAssetFieldType, string> = {
  text: 'テキスト',
  textarea: '長文テキスト',
  url: 'URL',
  number: '数値',
  date: '日付',
  reference: '参照',
  reference_multi: '複数参照',
};

function FieldRow({
  field,
  objects,
  onChange,
  onRemove,
}: {
  field: GlobalAssetField;
  objects: GlobalAssetObject[];
  onChange: (field: GlobalAssetField) => void;
  onRemove: () => void;
}) {
  const options = parseFieldOptions(field.options);
  return (
    <div className="grid grid-cols-[1.2fr_1fr_160px_180px_80px] gap-2 items-end">
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
            const nextType = e.target.value as GlobalAssetFieldType;
            onChange({
              ...field,
              type: nextType,
              options: nextType === 'reference' || nextType === 'reference_multi'
                ? JSON.stringify({ referenceObjectId: options.referenceObjectId || '' })
                : '{}',
            });
          }}
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">参照先</label>
        {(field.type === 'reference' || field.type === 'reference_multi') ? (
          <select
            className="field-input text-sm"
            value={options.referenceObjectId || ''}
            onChange={(e) => onChange({ ...field, options: JSON.stringify({ referenceObjectId: e.target.value }) })}
          >
            <option value="">（選択してください）</option>
            {objects.map((object) => (
              <option key={object.id} value={object.id}>{object.name}</option>
            ))}
          </select>
        ) : (
          <div className="text-xs px-2 py-2" style={{ color: 'var(--text-muted)' }}>不要</div>
        )}
      </div>
      <button onClick={onRemove} className="btn-danger">削除</button>
    </div>
  );
}

function RecordCard({
  object,
  record,
  expanded,
  objects,
  onToggle,
  onMetaChange,
  onChange,
  onRemove,
}: {
  object: GlobalAssetObject;
  record: GlobalAssetObject['records'][number];
  expanded: boolean;
  objects: GlobalAssetObject[];
  onToggle: () => void;
  onMetaChange: (patch: Pick<GlobalAssetObject['records'][number], 'name' | 'key'>) => void;
  onChange: (values: Record<string, string>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onToggle} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-violet-300">レコード</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </button>
        <button onClick={onRemove} className="btn-danger">削除</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">レコード名</label>
          <input className="field-input" value={record.name} onChange={(e) => onMetaChange({ name: e.target.value, key: record.key })} />
        </div>
        <div>
          <label className="field-label">レコードキー</label>
          <input className="field-input" value={record.key} onChange={(e) => onMetaChange({ name: record.name, key: e.target.value.replace(/\s+/g, '_') })} />
        </div>
      </div>
      {expanded && object.fields.map((field) => {
        const value = record.values[field.key] ?? '';
        const options = parseFieldOptions(field.options);
        const referenceObject = objects.find((item) => item.id === options.referenceObjectId);
        const referenceRecords = referenceObject?.records ?? [];
        const multiValue = (() => {
          if (field.type !== 'reference_multi') return [] as string[];
          try {
            const parsed = JSON.parse(value || '[]');
            return Array.isArray(parsed) ? parsed as string[] : [];
          } catch {
            return [];
          }
        })();
        return (
          <div key={field.id}>
            <label className="field-label">{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea className="field-input" rows={3} value={value} onChange={(e) => onChange({ ...record.values, [field.key]: e.target.value })} />
            ) : field.type === 'reference' ? (
              <select
                className="field-input"
                value={value}
                onChange={(e) => onChange({ ...record.values, [field.key]: e.target.value })}
              >
                <option value="">（選択してください）</option>
                {referenceRecords.map((referenceRecord) => (
                  <option key={referenceRecord.id} value={referenceRecord.key}>{referenceRecord.name}</option>
                ))}
              </select>
            ) : field.type === 'reference_multi' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="field-label mb-0 shrink-0">参照レコードを追加</label>
                  <select
                    className="field-input"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const next = Array.from(new Set([...multiValue, e.target.value]));
                      onChange({ ...record.values, [field.key]: JSON.stringify(next) });
                    }}
                  >
                    <option value="">（追加するレコードを選択）</option>
                    {referenceRecords.filter((referenceRecord) => !multiValue.includes(referenceRecord.key)).map((referenceRecord) => (
                      <option key={referenceRecord.id} value={referenceRecord.key}>{referenceRecord.name}</option>
                    ))}
                  </select>
                </div>
                {multiValue.length > 0 && (
                  <div className="space-y-2">
                    {multiValue.map((recordKey) => {
                      const referenceRecord = referenceRecords.find((item) => item.key === recordKey);
                      return (
                        <div key={recordKey} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs bg-white/70" style={{ borderColor: 'var(--border)' }}>
                          <span>{referenceRecord?.name || recordKey}</span>
                          <button
                            type="button"
                            className="transition-colors"
                            style={{ color: '#cc5c6d' }}
                            onClick={() => onChange({ ...record.values, [field.key]: JSON.stringify(multiValue.filter((item) => item !== recordKey)) })}
                          >
                            削除
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <input
                className="field-input"
                type={field.type === 'number' || field.type === 'date' || field.type === 'url' ? field.type : 'text'}
                value={value}
                onChange={(e) => onChange({ ...record.values, [field.key]: e.target.value })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GlobalAssetObjectDetailPage({ params }: { params: { objectId: string } }) {
  const { objectId } = params;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageGlobalAssets = Boolean(user?.system_permissions?.manage_master_data);
  const [data, setData] = useState<GlobalAssets>(EMPTY_GA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [objectSettingsOpen, setObjectSettingsOpen] = useState(false);
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const [openRecordIds, setOpenRecordIds] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData(EMPTY_GA);
      router.push(withBasePath('/login'));
      return;
    }
    if (!user.system_permissions?.manage_master_data) {
      setData(EMPTY_GA);
      router.push(withBasePath('/settings'));
      return;
    }

    (async () => {
      const res = await fetch(withBasePath('/api/master-data'));
      if (res.status === 401) {
        setData(EMPTY_GA);
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 403) {
        setData(EMPTY_GA);
        router.push(withBasePath('/settings'));
        return;
      }
      const payload = await res.json();
      setData(normalizeGlobalAssets(payload));
    })();
  }, [authLoading, router, user]);

  const objectIndex = useMemo(
    () => data.objects.findIndex((object) => object.id === objectId),
    [data.objects, objectId]
  );
  const object = objectIndex >= 0 ? data.objects[objectIndex] : null;

  async function persist(nextData: GlobalAssets) {
    setSaving(true);
    const res = await fetch(withBasePath('/api/master-data'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextData),
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

    setData(normalizeGlobalAssets(payload));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateObject(nextObject: GlobalAssetObject) {
    setData((current) => {
      const objects = [...current.objects];
      objects[objectIndex] = nextObject;
      return { ...current, objects };
    });
  }

  function addField() {
    if (!object) return;
    const nextFieldKey = `field_${object.fields.length + 1}`;
    updateObject({
      ...object,
      fields: [
        ...object.fields,
        {
          id: uuidv4(),
          key: nextFieldKey,
          label: '新しい項目',
          type: 'text',
          options: '{}',
        },
      ],
      records: object.records.map((record) => ({
        ...record,
        values: { ...record.values, [nextFieldKey]: '' },
      })),
    });
  }

  function updateField(fieldIndex: number, nextField: GlobalAssetField) {
    if (!object) return;
    const previousField = object.fields[fieldIndex];
    const fields = [...object.fields];
    fields[fieldIndex] = nextField;
    const records = object.records.map((record) => {
      const values = { ...record.values };
      const previousValue = values[previousField.key] ?? '';
      if (previousField.key !== nextField.key) delete values[previousField.key];
      values[nextField.key] = previousValue;
      return { ...record, values };
    });
    updateObject({ ...object, fields, records });
  }

  function removeField(fieldIndex: number) {
    if (!object) return;
    const removedField = object.fields[fieldIndex];
    updateObject({
      ...object,
      fields: object.fields.filter((_, index) => index !== fieldIndex),
      records: object.records.map((record) => {
        const values = { ...record.values };
        delete values[removedField.key];
        return { ...record, values };
      }),
    });
  }

  function addRecord() {
    if (!object) return;
    const nextIndex = object.records.length + 1;
    const nextId = uuidv4();
    updateObject({
      ...object,
      records: [
        ...object.records,
        {
          id: nextId,
          name: `レコード ${nextIndex}`,
          key: `${object.key.replace(/-/g, '_')}_${nextIndex}`,
          values: Object.fromEntries(object.fields.map((field) => [field.key, ''])),
        },
      ],
    });
    setOpenRecordIds((current) => [...current, nextId]);
  }

  function updateRecord(recordIndex: number, values: Record<string, string>) {
    if (!object) return;
    const records = [...object.records];
    records[recordIndex] = { ...records[recordIndex], values };
    updateObject({ ...object, records });
  }

  function updateRecordMeta(recordIndex: number, patch: Pick<GlobalAssetObject['records'][number], 'name' | 'key'>) {
    if (!object) return;
    const records = [...object.records];
    records[recordIndex] = { ...records[recordIndex], ...patch };
    updateObject({ ...object, records });
  }

  function removeRecord(recordIndex: number) {
    if (!object) return;
    const targetId = object.records[recordIndex]?.id;
    updateObject({ ...object, records: object.records.filter((_, index) => index !== recordIndex) });
    setOpenRecordIds((current) => current.filter((id) => id !== targetId));
  }

  function toggleRecord(recordId: string) {
    setOpenRecordIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    );
  }

  if (authLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  if (!user || !canManageGlobalAssets) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">マスターデータ</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              マスターデータ管理権限がないため、このページは表示できません。
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

  if (!object) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>オブジェクトが見つかりません。</p>
          <Link href={withBasePath('/master-data')} className="btn-secondary mt-4 inline-flex">一覧へ戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={withBasePath('/master-data')} className="text-sm text-gray-400 hover:text-gray-200">← マスターデータ 一覧へ戻る</Link>
          <h1 className="text-2xl font-bold mt-2">{object.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            このオブジェクトの設定とレコードを管理します。
          </p>
        </div>
        <button onClick={() => persist(data)} disabled={saving} className="btn-primary">
          {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
        </button>
      </div>

      <section className="card p-5 space-y-4">
        <button onClick={() => setObjectSettingsOpen((current) => !current)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <h2 className="section-title">オブジェクト設定</h2>
            {object.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">既定オブジェクト</span>}
          </div>
          <span className="text-sm text-gray-400">{objectSettingsOpen ? '▲' : '▼'}</span>
        </button>
        {objectSettingsOpen && (
          <>
            <div>
              <label className="field-label">オブジェクト名</label>
              <input className="field-input" value={object.name} onChange={(e) => updateObject({ ...object, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">説明</label>
              <textarea className="field-input" rows={3} value={object.description} onChange={(e) => updateObject({ ...object, description: e.target.value })} />
            </div>
            <div>
              <label className="field-label">オブジェクトキー</label>
              <input className="field-input" value={object.key} onChange={(e) => updateObject({ ...object, key: e.target.value.replace(/\s+/g, '_') })} />
            </div>
          </>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <button onClick={() => setFieldSettingsOpen((current) => !current)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <h2 className="section-title">項目設定</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{object.fields.length} 項目</span>
          </div>
          <span className="text-sm text-gray-400">{fieldSettingsOpen ? '▲' : '▼'}</span>
        </button>
        {fieldSettingsOpen && (
          <>
            <div className="flex justify-end">
              <button onClick={addField} className="btn-secondary text-xs py-1 px-3">+ 項目追加</button>
            </div>
            <div className="space-y-3">
              {object.fields.map((field, fieldIndex) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  objects={data.objects.filter((candidate) => candidate.id !== object.id)}
                  onChange={(nextField) => updateField(fieldIndex, nextField)}
                  onRemove={() => removeField(fieldIndex)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">レコード一覧</h2>
          <button onClick={addRecord} className="btn-secondary text-xs py-1 px-3">+ レコード追加</button>
        </div>
        {object.records.length === 0 ? (
          <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">まだレコードがありません</p>
            <button onClick={addRecord} className="btn-secondary text-xs mt-3">+ レコードを追加</button>
          </div>
        ) : (
          <div className="space-y-3">
            {object.records.map((record, recordIndex) => (
              <RecordCard
                key={record.id}
                object={object}
                record={record}
                expanded={openRecordIds.includes(record.id)}
                objects={data.objects.filter((candidate) => candidate.id !== object.id)}
                onToggle={() => toggleRecord(record.id)}
                onMetaChange={(patch) => updateRecordMeta(recordIndex, patch)}
                onChange={(values) => updateRecord(recordIndex, values)}
                onRemove={() => removeRecord(recordIndex)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
