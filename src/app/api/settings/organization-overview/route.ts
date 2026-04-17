import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getOrganizationRow, getOrganizationSettingsRow } from '@/lib/organization-settings';
import { normalizeGlobalAssetsRow } from '@/lib/global-assets';
import { normalizeAISettingsRow } from '@/lib/ai/settings';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { normalizeContentTemplatesRow } from '@/lib/content-templates';
import { hasSystemPermission, projectRoleDefinitions, systemRoleDefinitions } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await requireSession();
    try {
      const db = getDb();
      if (!hasSystemPermission(db, user.id, 'manage_organization_settings')) {
        return NextResponse.json({ error: '組織設定全体の閲覧権限がありません' }, { status: 403 });
      }
      const organization = getOrganizationRow(db, user.organization_id);

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
      const globalAssets = normalizeGlobalAssetsRow(settingsRow);
      const aiSettings = normalizeAISettingsRow(settingsRow);
      const projectTypes = normalizeProjectTypeDefinitionsRow(settingsRow);
      const contentTemplates = normalizeContentTemplatesRow(settingsRow);

      const canManageUsers = hasSystemPermission(db, user.id, 'manage_users');
      const canManageSystemRoles = hasSystemPermission(db, user.id, 'manage_system_roles');
      const canManageProjectRoles = hasSystemPermission(db, user.id, 'manage_project_roles');

      const userCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE organization_id = ?').get(user.organization_id) as { count: number }).count;
      const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?').get(user.organization_id) as { count: number }).count;

      const users = canManageUsers
        ? db.prepare(`
            SELECT id, email, name, avatar_url, system_role, created_at
            FROM users
            WHERE organization_id = ?
            ORDER BY COALESCE(NULLIF(name, ''), email) ASC
          `).all(user.organization_id)
        : [];

      const systemRoles = canManageSystemRoles ? systemRoleDefinitions(db) : [];
      const projectRoles = canManageProjectRoles ? projectRoleDefinitions(db) : [];

      return NextResponse.json({
        organization,
        summary: {
          user_count: userCount,
          project_count: projectCount,
          global_asset_object_count: globalAssets.objects.length,
          project_type_count: projectTypes.length,
          content_template_count: contentTemplates.length,
        },
        permissions: {
          can_manage_users: canManageUsers,
          can_manage_system_roles: canManageSystemRoles,
          can_manage_project_roles: canManageProjectRoles,
        },
        settings: {
          ai: {
            provider: aiSettings.provider,
            model: aiSettings.model,
            base_url: aiSettings.base_url,
            has_api_key: Boolean(aiSettings.api_key),
          },
          global_assets: {
            updated_at: globalAssets.updated_at,
            objects: globalAssets.objects.map((object) => ({
              id: object.id,
              key: object.key,
              name: object.name,
              description: object.description,
              is_default: Boolean(object.is_default),
              field_count: object.fields.length,
              record_count: object.records.length,
            })),
          },
          project_types: projectTypes.map((definition) => ({
            id: definition.id,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            phase_count: definition.phases.length,
            section_count: definition.sections.length,
            field_template_count: definition.field_templates.length,
            content_template_count: definition.content_template_ids.length,
          })),
          content_templates: contentTemplates.map((template) => ({
            id: template.id,
            key: template.key,
            name: template.name,
            channel: template.channel === 'other' ? template.channel_other || 'other' : template.channel,
            text_format: template.text_format,
            tone: template.tone,
          })),
          users,
          system_roles: systemRoles.map((role) => ({
            id: role.id,
            key: role.key,
            name: role.name,
            description: role.description,
            permission_count: Object.values(role.permissions).filter(Boolean).length,
          })),
          project_roles: projectRoles.map((role) => ({
            id: role.id,
            key: role.key,
            name: role.name,
            description: role.description,
            permission_count: Object.values(role.permissions).filter(Boolean).length,
          })),
        },
      });
    } catch (error) {
      console.error('Failed to load organization overview', error);
      return NextResponse.json({ error: '組織設定全体の取得に失敗しました' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
