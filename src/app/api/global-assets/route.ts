import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveLegacyGlobalAssetColumns, normalizeGlobalAssets, normalizeGlobalAssetsRow, serializeGlobalAssetObjects } from '@/lib/global-assets';
import { DEFAULT_ORGANIZATION_SCOPE, getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  try {
    await requireSession();
    const db = getDb();
    const assets = getOrganizationSettingsRow(db);
    return NextResponse.json(normalizeGlobalAssetsRow(assets));
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_global_assets')) {
      return NextResponse.json({ error: 'Global Assets 管理権限がありません' }, { status: 403 });
    }
    const body = normalizeGlobalAssets(await request.json());
    const legacy = deriveLegacyGlobalAssetColumns(body.objects);
    getOrganizationSettingsRow(db);

    db.prepare(`
      UPDATE organization_settings SET
        company_name = ?,
        company_description = ?,
        brand_voice = ?,
        brand_guidelines = ?,
        products = ?,
        objects = ?,
        updated_at = datetime('now')
      WHERE scope_key = ?
    `).run(
      legacy.company_name,
      legacy.company_description,
      legacy.brand_voice,
      legacy.brand_guidelines,
      legacy.products,
      serializeGlobalAssetObjects(body.objects),
      DEFAULT_ORGANIZATION_SCOPE
    );

    const updated = getOrganizationSettingsRow(db);
    return NextResponse.json(normalizeGlobalAssetsRow(updated));
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
