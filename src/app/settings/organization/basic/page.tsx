'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

type OrganizationBasic = {
  id: string;
  name: string;
  slug: string;
  status: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  default_language: string;
  default_locale: string;
  default_time_zone: string;
  currency_locale: string;
};

const EMPTY_ORGANIZATION: OrganizationBasic = {
  id: '',
  name: '',
  slug: '',
  status: 'active',
  address_street: '',
  address_city: '',
  address_state: '',
  address_postal_code: '',
  address_country: 'Japan',
  default_language: 'ja',
  default_locale: 'ja-JP',
  default_time_zone: 'Asia/Tokyo',
  currency_locale: 'ja-JP',
};

export default function OrganizationBasicPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageOrganizationSettings = Boolean(user?.system_permissions?.manage_organization_settings);
  const [organization, setOrganization] = useState<OrganizationBasic>(EMPTY_ORGANIZATION);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    if (!user.system_permissions?.manage_organization_settings) {
      router.push(withBasePath('/settings'));
      return;
    }

    (async () => {
      const res = await fetch(withBasePath('/api/settings/organization-basic'));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 403) {
        router.push(withBasePath('/settings'));
        return;
      }
      if (!res.ok) {
        setError('組織基本設定の取得に失敗しました');
        return;
      }
      const payload = await res.json() as { organization?: OrganizationBasic; can_edit?: boolean };
      setOrganization(payload.organization || EMPTY_ORGANIZATION);
      setCanEdit(Boolean(payload.can_edit));
    })();
  }, [authLoading, router, user]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');

    const res = await fetch(withBasePath('/api/settings/organization-basic'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization }),
    });
    const payload = await res.json() as { organization?: OrganizationBasic; error?: string };
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
      setError(payload.error || '保存に失敗しました');
      return;
    }

    setOrganization(payload.organization || organization);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (!canManageOrganizationSettings) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">組織基本設定</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              組織設定管理権限がないため、このページは表示できません。
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
          <h1 className="text-xl font-bold">組織基本設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            組織の表示名や既定値を管理します。データ連携の正本は変更不可の Organization ID です。
          </p>
        </div>
        <button onClick={() => router.push(withBasePath('/settings/organization'))} className="btn-secondary">
          ← 組織設定全体へ戻る
        </button>
      </div>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">識別情報</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            連携・権限制御は Organization ID を正本にしています。slug は表示用の別名で、データ紐付けには使いません。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="field-label !mb-0">Organization ID</label>
              <span className="badge-readonly">読み取り専用</span>
            </div>
            <input className="field-input" value={organization.id} disabled />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="field-label !mb-0">Slug</label>
              <span className="badge-readonly">読み取り専用</span>
            </div>
            <input className="field-input" value={organization.slug} disabled />
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">組織情報</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            組織名と状態を管理します。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">組織名</label>
            <input className="field-input" value={organization.name} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">状態</label>
            <select className="field-input" value={organization.status} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, status: e.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">住所</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            組織の所在地情報です。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="field-label">住所</label>
            <input className="field-input" value={organization.address_street} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, address_street: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">市区町村</label>
            <input className="field-input" value={organization.address_city} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, address_city: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">都道府県・州</label>
            <input className="field-input" value={organization.address_state} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, address_state: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">郵便番号</label>
            <input className="field-input" value={organization.address_postal_code} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, address_postal_code: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">国</label>
            <input className="field-input" value={organization.address_country} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, address_country: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">既定値</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            既定言語、ロケール、タイムゾーン、通貨ロケールを管理します。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">既定言語</label>
            <input className="field-input" value={organization.default_language} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, default_language: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">既定ロケール</label>
            <input className="field-input" value={organization.default_locale} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, default_locale: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">既定タイムゾーン</label>
            <input className="field-input" value={organization.default_time_zone} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, default_time_zone: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">通貨ロケール</label>
            <input className="field-input" value={organization.currency_locale} disabled={!canEdit} onChange={(e) => setOrganization((current) => ({ ...current, currency_locale: e.target.value }))} />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'rgba(248,113,113,0.35)', color: 'rgb(252,165,165)' }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {canEdit ? 'この設定は組織全体に反映されます。Organization ID と slug は読み取り専用です。' : 'この組織基本設定は閲覧のみ可能です。'}
        </p>
        {canEdit && (
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        )}
      </div>
    </div>
  );
}
