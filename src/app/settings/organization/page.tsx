'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

type OverviewPayload = {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_postal_code?: string;
    address_country?: string;
    default_language?: string;
    default_locale?: string;
    default_time_zone?: string;
    currency_locale?: string;
    created_at?: string;
    updated_at?: string;
  };
  summary: {
    user_count: number;
    project_count: number;
    global_asset_object_count: number;
    project_type_count: number;
    content_template_count: number;
  };
  permissions: {
    can_manage_users: boolean;
    can_manage_system_roles: boolean;
    can_manage_project_roles: boolean;
  };
  settings: {
    ai: {
      provider: string;
      model: string;
      base_url: string;
      has_api_key: boolean;
    };
    global_assets: {
      updated_at?: string;
      objects: Array<{
        id: string;
        key: string;
        name: string;
        description: string;
        is_default: boolean;
        field_count: number;
        record_count: number;
      }>;
    };
    project_types: Array<{
      id: string;
      key: string;
      name: string;
      description: string;
      phase_count: number;
      section_count: number;
      field_template_count: number;
      content_template_count: number;
    }>;
    content_templates: Array<{
      id: string;
      key: string;
      name: string;
      channel: string;
      text_format: string;
      tone: string;
    }>;
    users: Array<{
      id: string;
      email: string;
      name: string | null;
      avatar_url?: string | null;
      system_role?: string;
      created_at?: string;
    }>;
    system_roles: Array<{
      id: string;
      key: string;
      name: string;
      description: string;
      permission_count: number;
    }>;
    project_roles: Array<{
      id: string;
      key: string;
      name: string;
      description: string;
      permission_count: number;
    }>;
  };
};

type SectionKey =
  | 'organization'
  | 'ai'
  | 'global_assets'
  | 'project_types'
  | 'content_templates'
  | 'users'
  | 'system_roles'
  | 'project_roles';

function MetaItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium mt-1 break-all">{value}</p>
    </div>
  );
}

function SectionBlock({
  title,
  subtitle,
  open,
  onToggle,
  count,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left border-b"
        style={{ borderColor: open ? 'var(--border)' : 'transparent' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="section-title">{title}</h2>
            {typeof count === 'number' && (
              <span
                className="text-[11px] px-2 py-1 rounded-full border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {action}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{open ? '閉じる' : '開く'}</span>
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

function includesQuery(query: string, values: Array<string | number | null | undefined>) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalized));
}

export default function OrganizationOverviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageOrganizationSettings = Boolean(user?.system_permissions?.manage_organization_settings);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    organization: true,
    ai: true,
    global_assets: true,
    project_types: true,
    content_templates: true,
    users: false,
    system_roles: false,
    project_roles: false,
  });

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
      const res = await fetch(withBasePath('/api/settings/organization-overview'));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 403) {
        router.push(withBasePath('/settings'));
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const payload = await res.json() as OverviewPayload;
      setOverview(payload);
      setLoading(false);
    })();
  }, [authLoading, router, user]);

  const filtered = useMemo(() => {
    if (!overview) return null;
    return {
      globalAssets: overview.settings.global_assets.objects.filter((object) =>
        includesQuery(query, [object.name, object.key, object.description, object.field_count, object.record_count]),
      ),
      projectTypes: overview.settings.project_types.filter((definition) =>
        includesQuery(query, [
          definition.name,
          definition.key,
          definition.description,
          definition.phase_count,
          definition.section_count,
          definition.field_template_count,
        ]),
      ),
      contentTemplates: overview.settings.content_templates.filter((template) =>
        includesQuery(query, [template.name, template.key, template.channel, template.text_format, template.tone]),
      ),
      users: overview.settings.users.filter((member) =>
        includesQuery(query, [member.name, member.email, member.system_role]),
      ),
      systemRoles: overview.settings.system_roles.filter((role) =>
        includesQuery(query, [role.name, role.key, role.description, role.permission_count]),
      ),
      projectRoles: overview.settings.project_roles.filter((role) =>
        includesQuery(query, [role.name, role.key, role.description, role.permission_count]),
      ),
    };
  }, [overview, query]);

  function toggleSection(key: SectionKey) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function openAll() {
    setOpenSections({
      organization: true,
      ai: true,
      global_assets: true,
      project_types: true,
      content_templates: true,
      users: true,
      system_roles: true,
      project_roles: true,
    });
  }

  function closeAll() {
    setOpenSections({
      organization: false,
      ai: false,
      global_assets: false,
      project_types: false,
      content_templates: false,
      users: false,
      system_roles: false,
      project_roles: false,
    });
  }

  if (authLoading || !user || loading || !overview || !filtered) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (!canManageOrganizationSettings) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">組織設定全体</h1>
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">組織設定全体</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            この組織で使っている設定を横断して確認できます。
          </p>
        </div>
        <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary shrink-0">
          ← 設定へ戻る
        </button>
      </div>

      <section className="card p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full">
            <MetaItem label="Organization ID" value={overview.organization.id} />
            <MetaItem label="組織名" value={overview.organization.name} />
            <MetaItem label="Slug" value={overview.organization.slug} />
            <MetaItem label="ユーザー数" value={overview.summary.user_count} />
            <MetaItem label="プロジェクト数" value={overview.summary.project_count} />
            <MetaItem label="状態" value={overview.organization.status} />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            className="field-input md:max-w-md"
            placeholder="名前、キー、説明、メールアドレスなどで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary text-xs py-1 px-3" onClick={() => router.push(withBasePath('/settings/organization/basic'))}>基本設定</button>
            <button type="button" className="btn-secondary text-xs py-1 px-3" onClick={openAll}>すべて開く</button>
            <button type="button" className="btn-secondary text-xs py-1 px-3" onClick={closeAll}>すべて閉じる</button>
          </div>
        </div>
      </section>

      <SectionBlock
        title="組織情報"
        subtitle="組織名、住所、既定ロケール"
        open={openSections.organization}
        onToggle={() => toggleSection('organization')}
        action={
          <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/settings/organization/basic')); }}>
            基本設定
          </button>
        }
      >
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          データ連携と権限制御は Organization ID を正本にしています。slug は表示用の別名です。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetaItem label="Organization ID" value={overview.organization.id} />
          <MetaItem label="組織名" value={overview.organization.name} />
          <MetaItem label="Slug" value={overview.organization.slug} />
          <MetaItem label="既定言語" value={overview.organization.default_language || 'ja'} />
          <MetaItem label="既定ロケール" value={overview.organization.default_locale || 'ja-JP'} />
          <MetaItem label="既定タイムゾーン" value={overview.organization.default_time_zone || 'Asia/Tokyo'} />
          <MetaItem label="通貨ロケール" value={overview.organization.currency_locale || 'ja-JP'} />
        </div>
        {(overview.organization.address_street || overview.organization.address_city || overview.organization.address_state || overview.organization.address_postal_code || overview.organization.address_country) && (
          <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>住所</p>
            <p className="text-sm mt-2">
              {[
                overview.organization.address_postal_code,
                overview.organization.address_state,
                overview.organization.address_city,
                overview.organization.address_street,
                overview.organization.address_country,
              ].filter(Boolean).join(' ')}
            </p>
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        title="AI設定"
        subtitle="現在この組織で使っているAI設定"
        open={openSections.ai}
        onToggle={() => toggleSection('ai')}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetaItem label="Provider" value={overview.settings.ai.provider} />
          <MetaItem label="Model" value={overview.settings.ai.model} />
          <MetaItem label="API Key" value={overview.settings.ai.has_api_key ? '保存済み' : '未設定'} />
          <MetaItem label="Base URL" value={overview.settings.ai.base_url} />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Global Assets"
        subtitle="オブジェクト一覧"
        open={openSections.global_assets}
        onToggle={() => toggleSection('global_assets')}
        count={filtered.globalAssets.length}
        action={
          <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/global-assets')); }}>
            開く
          </button>
        }
      >
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.globalAssets.map((object) => (
            <div key={object.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{object.name}</p>
                  {object.is_default && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      組み込み
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{object.key}</p>
                {object.description && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{object.description}</p>
                )}
              </div>
              <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                <p>項目 {object.field_count}</p>
                <p className="mt-1">レコード {object.record_count}</p>
              </div>
            </div>
          ))}
          {filtered.globalAssets.length === 0 && (
            <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当する Global Assets はありません。</div>
          )}
        </div>
      </SectionBlock>

      <SectionBlock
        title="プロジェクト設定"
        subtitle="プロジェクト種別一覧"
        open={openSections.project_types}
        onToggle={() => toggleSection('project_types')}
        count={filtered.projectTypes.length}
        action={
          <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/project-types')); }}>
            開く
          </button>
        }
      >
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.projectTypes.map((definition) => (
            <div key={definition.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{definition.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{definition.key}</p>
                {definition.description && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{definition.description}</p>
                )}
              </div>
              <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                <p>フェーズ {definition.phase_count}</p>
                <p className="mt-1">セクション {definition.section_count}</p>
                <p className="mt-1">項目 {definition.field_template_count}</p>
                <p className="mt-1">生成 {definition.content_template_count}</p>
              </div>
            </div>
          ))}
          {filtered.projectTypes.length === 0 && (
            <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当するプロジェクト種別はありません。</div>
          )}
        </div>
      </SectionBlock>

      <SectionBlock
        title="生成コンテンツ設定"
        subtitle="テンプレート一覧"
        open={openSections.content_templates}
        onToggle={() => toggleSection('content_templates')}
        count={filtered.contentTemplates.length}
        action={
          <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/settings/content-templates')); }}>
            開く
          </button>
        }
      >
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.contentTemplates.map((template) => (
            <div key={template.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{template.key}</p>
              </div>
              <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                <p>{template.channel}</p>
                <p className="mt-1">{template.text_format}</p>
                <p className="mt-1">{template.tone || 'tone未設定'}</p>
              </div>
            </div>
          ))}
          {filtered.contentTemplates.length === 0 && (
            <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当する生成テンプレートはありません。</div>
          )}
        </div>
      </SectionBlock>

      {overview.permissions.can_manage_users && (
        <SectionBlock
          title="ユーザー管理"
          subtitle="同一組織のユーザー一覧"
          open={openSections.users}
          onToggle={() => toggleSection('users')}
          count={filtered.users.length}
          action={
            <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/settings/users')); }}>
              開く
            </button>
          }
        >
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.users.map((member) => (
              <div key={member.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{member.name || '未設定'}</p>
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{member.email}</p>
                </div>
                <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{member.system_role || 'USER'}</div>
              </div>
            ))}
            {filtered.users.length === 0 && (
              <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当するユーザーはありません。</div>
            )}
          </div>
        </SectionBlock>
      )}

      {overview.permissions.can_manage_system_roles && (
        <SectionBlock
          title="システムロール"
          open={openSections.system_roles}
          onToggle={() => toggleSection('system_roles')}
          count={filtered.systemRoles.length}
          action={
            <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/settings/roles')); }}>
              開く
            </button>
          }
        >
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.systemRoles.map((role) => (
              <div key={role.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{role.key}</p>
                  {role.description && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{role.description}</p>
                  )}
                </div>
                <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>権限 {role.permission_count}</div>
              </div>
            ))}
            {filtered.systemRoles.length === 0 && (
              <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当するシステムロールはありません。</div>
            )}
          </div>
        </SectionBlock>
      )}

      {overview.permissions.can_manage_project_roles && (
        <SectionBlock
          title="プロジェクトロール"
          open={openSections.project_roles}
          onToggle={() => toggleSection('project_roles')}
          count={filtered.projectRoles.length}
          action={
            <button className="btn-secondary text-xs py-1 px-3" onClick={(e) => { e.stopPropagation(); router.push(withBasePath('/settings/project-roles')); }}>
              開く
            </button>
          }
        >
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.projectRoles.map((role) => (
              <div key={role.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{role.key}</p>
                  {role.description && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{role.description}</p>
                  )}
                </div>
                <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>権限 {role.permission_count}</div>
              </div>
            ))}
            {filtered.projectRoles.length === 0 && (
              <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>該当するプロジェクトロールはありません。</div>
            )}
          </div>
        </SectionBlock>
      )}
    </div>
  );
}
