import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveLegacyGlobalAssetColumns, normalizeGlobalAssets, normalizeGlobalAssetsRow, serializeGlobalAssetObjects } from '@/lib/global-assets';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const assets = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json(normalizeGlobalAssetsRow(assets));
  } catch (err) {
    console.error('GET /api/master-data failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_master_data')) {
      return NextResponse.json({ error: 'マスターデータ管理権限がありません' }, { status: 403 });
    }
    const body = normalizeGlobalAssets(await request.json());
    const legacy = deriveLegacyGlobalAssetColumns(body.objects);
    getOrganizationSettingsRow(db, user.organization_id);

    db.prepare(`
      UPDATE organization_settings SET
        company_name = ?,
        company_description = ?,
        brand_voice = ?,
        brand_guidelines = ?,
        products = ?,
        objects = ?,
        updated_at = datetime('now')
      WHERE organization_id = ?
    `).run(
      legacy.company_name,
      legacy.company_description,
      legacy.brand_voice,
      legacy.brand_guidelines,
      legacy.products,
      serializeGlobalAssetObjects(body.objects),
      user.organization_id
    );

    const updated = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json(normalizeGlobalAssetsRow(updated));
  } catch (err) {
    console.error('PUT /api/master-data failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
