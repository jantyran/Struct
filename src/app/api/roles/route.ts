import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { hasSystemPermission, normalizeSystemPermissions, systemRoleDefinitions } from '@/lib/permissions';
import { v4 as uuidv4 } from 'uuid';

function normalizeRoleKey(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_system_roles')) {
      return NextResponse.json({ error: 'システムロール管理権限がありません' }, { status: 403 });
    }
    return NextResponse.json({ roles: systemRoleDefinitions(db) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_system_roles')) {
      return NextResponse.json({ error: 'システムロール管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as {
      roles?: Array<{
        id?: string;
        key?: string;
        name?: string;
        description?: string;
        permissions?: unknown;
        is_system?: boolean;
        sort_order?: number;
      }>;
    };

    if (!Array.isArray(body.roles)) {
      return NextResponse.json({ error: 'roles が必要です' }, { status: 400 });
    }

    const normalized = body.roles.map((role, index) => ({
      id: role.id || uuidv4(),
      key: normalizeRoleKey(role.key || role.name || `ROLE_${index + 1}`),
      name: role.name?.trim() || role.key || `ロール ${index + 1}`,
      description: role.description?.trim() || '',
      permissions: normalizeSystemPermissions(role.permissions),
      is_system: role.is_system === true,
      sort_order: role.sort_order ?? index,
    })).filter((role) => role.key && role.name);

    if (normalized.length === 0) {
      return NextResponse.json({ error: 'ロールを1つ以上設定してください' }, { status: 400 });
    }

    const keys = new Set<string>();
    for (const role of normalized) {
      if (keys.has(role.key)) {
        return NextResponse.json({ error: `ロールキーが重複しています: ${role.key}` }, { status: 400 });
      }
      keys.add(role.key);
    }

    const usedRoles = db.prepare('SELECT DISTINCT system_role FROM users').all() as Array<{ system_role: string }>;
    for (const used of usedRoles) {
      if (used.system_role && !keys.has(used.system_role)) {
        return NextResponse.json({ error: `使用中のシステムロール「${used.system_role}」は削除できません` }, { status: 400 });
      }
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM system_role_definitions').run();
      for (const role of normalized) {
        db.prepare(`
          INSERT INTO system_role_definitions (id, key, name, description, permissions, is_system, sort_order, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          role.id,
          role.key,
          role.name,
          role.description,
          JSON.stringify(role.permissions),
          role.is_system ? 1 : 0,
          role.sort_order,
        );
      }
    });
    tx();

    return NextResponse.json({ roles: systemRoleDefinitions(db) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
