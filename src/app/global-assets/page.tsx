'use client';
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GlobalAssets, Product } from '@/types';

const EMPTY_GA: GlobalAssets = {
  company_name: '',
  company_description: '',
  brand_voice: '',
  brand_guidelines: '',
  products: [],
  updated_at: '',
};

function ProductCard({ product, onChange, onRemove }: {
  product: Product;
  onChange: (p: Product) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-300">製品 / サービス</span>
        <button onClick={onRemove} className="btn-danger">削除</button>
      </div>
      <div>
        <label className="field-label">名称</label>
        <input className="field-input" value={product.name} onChange={e => onChange({ ...product, name: e.target.value })} placeholder="例: Eidos Pro" />
      </div>
      <div>
        <label className="field-label">概要</label>
        <textarea className="field-input" rows={2} value={product.description} onChange={e => onChange({ ...product, description: e.target.value })} placeholder="製品・サービスの説明" />
      </div>
      <div>
        <label className="field-label">機能・特徴</label>
        <textarea className="field-input" rows={2} value={product.features} onChange={e => onChange({ ...product, features: e.target.value })} placeholder="主要な機能や特徴を記述" />
      </div>
      <div>
        <label className="field-label">価格</label>
        <input className="field-input" value={product.price} onChange={e => onChange({ ...product, price: e.target.value })} placeholder="例: ¥9,800/月（税込）" />
      </div>
    </div>
  );
}

export default function GlobalAssetsPage() {
  const [data, setData] = useState<GlobalAssets>(EMPTY_GA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/global-assets').then(r => r.json()).then(setData);
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/global-assets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addProduct() {
    setData(d => ({ ...d, products: [...d.products, { id: uuidv4(), name: '', description: '', features: '', price: '' }] }));
  }

  function updateProduct(idx: number, p: Product) {
    setData(d => { const ps = [...d.products]; ps[idx] = p; return { ...d, products: ps }; });
  }

  function removeProduct(idx: number) {
    setData(d => ({ ...d, products: d.products.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Global Assets</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>全プロジェクト共通の会社・ブランド情報</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
        </button>
      </div>

      <div className="space-y-6">
        {/* 会社情報 */}
        <section>
          <h2 className="section-title mb-3">会社情報</h2>
          <div className="card p-5 space-y-4">
            <div>
              <label className="field-label">会社名</label>
              <input className="field-input" value={data.company_name} onChange={e => setData(d => ({ ...d, company_name: e.target.value }))} placeholder="株式会社〇〇" />
            </div>
            <div>
              <label className="field-label">会社概要</label>
              <textarea className="field-input" rows={3} value={data.company_description} onChange={e => setData(d => ({ ...d, company_description: e.target.value }))} placeholder="会社のミッション、事業内容、主な実績など" />
            </div>
          </div>
        </section>

        {/* ブランド */}
        <section>
          <h2 className="section-title mb-3">ブランド定義</h2>
          <div className="card p-5 space-y-4">
            <div>
              <label className="field-label">ブランドボイス</label>
              <textarea className="field-input" rows={3} value={data.brand_voice} onChange={e => setData(d => ({ ...d, brand_voice: e.target.value }))} placeholder="例: 誠実で専門的。難しい言葉を使わず、親しみやすいが信頼感のあるトーンで。" />
            </div>
            <div>
              <label className="field-label">ブランドガイドライン</label>
              <textarea className="field-input" rows={4} value={data.brand_guidelines} onChange={e => setData(d => ({ ...d, brand_guidelines: e.target.value }))} placeholder="使用してはいけない言葉、強調すべきポジション、競合との差別化ポイントなど" />
            </div>
          </div>
        </section>

        {/* 製品 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">製品・サービス</h2>
            <button onClick={addProduct} className="btn-secondary text-xs py-1 px-3">+ 追加</button>
          </div>
          {data.products.length === 0 ? (
            <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">製品・サービス情報を追加してください</p>
              <button onClick={addProduct} className="btn-secondary text-xs mt-3">+ 製品を追加</button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.products.map((p, i) => (
                <ProductCard key={p.id} product={p} onChange={np => updateProduct(i, np)} onRemove={() => removeProduct(i)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {data.updated_at && (
        <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          最終更新: {new Date(data.updated_at).toLocaleString('ja-JP')}
        </p>
      )}
    </div>
  );
}
