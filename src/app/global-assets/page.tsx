'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { GlobalAssets, GlobalAssetObject } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';
import { createGlobalAssetObject, defaultGlobalAssetObjects, normalizeGlobalAssets } from '@/lib/global-assets';

const EMPTY_GA: GlobalAssets = {
  objects: defaultGlobalAssetObjects(),
  updated_at: '',
};

function NewObjectModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: { name: string; key: string; description: string }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  const normalizedKey = key.replace(/\s+/g, '_');
  const canSubmit = name.trim().length > 0 && normalizedKey.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-5">新しいオブジェクトを追加</h2>
        <div className="space-y-4">
          <div>
            <label className="field-label">オブジェクト名 *</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 導入事例" autoFocus />
          </div>
          <div>
            <label className="field-label">オブジェクトキー *</label>
            <input className="field-input" value={normalizedKey} onChange={(e) => setKey(e.target.value)} placeholder="case_studies" />
          </div>
          <div>
            <label className="field-label">説明</label>
            <textarea className="field-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="このオブジェクトで管理する内容" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>キャンセル</button>
          <button
            onClick={() => onSubmit({ name: name.trim(), key: normalizedKey.trim(), description: description.trim() })}
            disabled={!canSubmit || submitting}
            className="btn-primary flex-1"
          >
            {submitting ? '保存中...' : '保存して詳細へ'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GlobalAssetsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<GlobalAssets>(EMPTY_GA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewObjectModal, setShowNewObjectModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData(EMPTY_GA);
      router.push(withBasePath('/login'));
      return;
    }

    (async () => {
      const res = await fetch(withBasePath('/api/global-assets'));
      const payload = await res.json();
      if (res.status === 401) {
        setData(EMPTY_GA);
        router.push(withBasePath('/login'));
        return;
      }
      setData(normalizeGlobalAssets(payload));
    })();
  }, [authLoading, router, user]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(withBasePath('/api/global-assets'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await res.json();
    setSaving(false);

    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }

    setData(normalizeGlobalAssets(payload));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function removeObject(index: number) {
    setData((current) => ({ ...current, objects: current.objects.filter((_, objectIndex) => objectIndex !== index) }));
  }

  async function createObjectAndOpen(payload: { name: string; key: string; description: string }) {
    const nextObject = createGlobalAssetObject({
      id: uuidv4(),
      key: payload.key,
      name: payload.name,
      description: payload.description,
    });
    const nextData = {
      ...data,
      objects: [...data.objects, nextObject],
    };

    setSaving(true);
    const res = await fetch(withBasePath('/api/global-assets'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextData),
    });
    const payloadResponse = await res.json();
    setSaving(false);

    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }

    setData(normalizeGlobalAssets(payloadResponse));
    setSaved(true);
    setShowNewObjectModal(false);
    setTimeout(() => setSaved(false), 2500);
    router.push(withBasePath(`/global-assets/${nextObject.id}`));
  }

  if (authLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Global Assets</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            オブジェクト一覧と管理ハブです。各オブジェクトの設定とレコード編集は詳細ページで行います。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNewObjectModal(true)} className="btn-secondary">+ オブジェクト追加</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {data.objects.map((object, objectIndex) => (
          <section key={object.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{object.name}</h2>
                  {object.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">既定</span>}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>キー: {object.key}</p>
                {object.description && (
                  <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{object.description}</p>
                )}
                <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>項目 {object.fields.length}</span>
                  <span>レコード {object.records.length}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={withBasePath(`/global-assets/${object.id}`)} className="btn-primary text-sm">
                  詳細を開く
                </Link>
                <button onClick={() => removeObject(objectIndex)} className="btn-danger text-sm">削除</button>
              </div>
            </div>
          </section>
        ))}
      </div>

      {data.updated_at && (
        <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          最終更新: {new Date(data.updated_at).toLocaleString('ja-JP')}
        </p>
      )}

      {showNewObjectModal && (
        <NewObjectModal
          onClose={() => setShowNewObjectModal(false)}
          onSubmit={createObjectAndOpen}
          submitting={saving}
        />
      )}
    </div>
  );
}
