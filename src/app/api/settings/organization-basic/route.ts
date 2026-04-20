import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getOrganizationRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeOrganization(organization: any) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    address_street: organization.address_street || '',
    address_city: organization.address_city || '',
    address_state: organization.address_state || '',
    address_postal_code: organization.address_postal_code || '',
    address_country: organization.address_country || '',
    default_language: organization.default_language || 'ja',
    default_locale: organization.default_locale || 'ja-JP',
    default_time_zone: organization.default_time_zone || 'Asia/Tokyo',
    currency_locale: organization.currency_locale || 'ja-JP',
  };
}

export async function GET() {
  try {
    const user = await requireSession();
    try {
      const db = getDb();
      const organization = getOrganizationRow(db, user.organization_id);
      return NextResponse.json({
        organization: serializeOrganization(organization),
        can_edit: hasSystemPermission(db, user.id, 'manage_organization_settings'),
      });
    } catch (error) {
      console.error('Failed to load organization basic settings', error);
      return NextResponse.json({ error: '組織基本設定の取得に失敗しました' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    try {
      if (!hasSystemPermission(db, user.id, 'manage_organization_settings')) {
        return NextResponse.json({ error: '組織基本設定の編集権限がありません' }, { status: 403 });
      }

      const body = await request.json() as {
        organization?: {
          name?: string;
          status?: string;
          address_street?: string;
          address_city?: string;
          address_state?: string;
          address_postal_code?: string;
          address_country?: string;
          default_language?: string;
          default_locale?: string;
          default_time_zone?: string;
          currency_locale?: string;
        };
      };

      const current = getOrganizationRow(db, user.organization_id);
      const next = {
        name: normalizeText(body.organization?.name) || current.name,
        slug: current.slug,
        status: normalizeText(body.organization?.status) || current.status || 'active',
        address_street: normalizeText(body.organization?.address_street),
        address_city: normalizeText(body.organization?.address_city),
        address_state: normalizeText(body.organization?.address_state),
        address_postal_code: normalizeText(body.organization?.address_postal_code),
        address_country: normalizeText(body.organization?.address_country),
        default_language: normalizeText(body.organization?.default_language) || 'ja',
        default_locale: normalizeText(body.organization?.default_locale) || 'ja-JP',
        default_time_zone: normalizeText(body.organization?.default_time_zone) || 'Asia/Tokyo',
        currency_locale: normalizeText(body.organization?.currency_locale) || 'ja-JP',
      };

      db.prepare(`
        UPDATE organizations SET
          name = ?,
          status = ?,
          address_street = ?,
          address_city = ?,
          address_state = ?,
          address_postal_code = ?,
          address_country = ?,
          default_language = ?,
          default_locale = ?,
          default_time_zone = ?,
          currency_locale = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        next.name,
        next.status,
        next.address_street,
        next.address_city,
        next.address_state,
        next.address_postal_code,
        next.address_country,
        next.default_language,
        next.default_locale,
        next.default_time_zone,
        next.currency_locale,
        current.id,
      );

      return NextResponse.json({
        organization: serializeOrganization(getOrganizationRow(db, current.id)),
        can_edit: true,
      });
    } catch (error) {
      console.error('Failed to update organization basic settings', error);
      return NextResponse.json({ error: '組織基本設定の保存に失敗しました' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
