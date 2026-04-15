import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeProjectMemberRole, projectRoleExists, requireProjectPermission } from '@/lib/permissions';
import { v4 as uuidv4 } from 'uuid';

interface Params { params: { id: string } }

function normalizeRole(role: unknown) {
  return normalizeProjectMemberRole(role);
}

function getProjectManager(db: ReturnType<typeof getDb>, projectId: string, userId: string) {
  return db.prepare(`
    SELECT p.owner_id, m.role AS member_role
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id AND m.user_id = ?
    WHERE p.id = ?
  `).get(userId, projectId) as { owner_id: string; member_role?: string } | undefined;
}

function canManageMembers(db: ReturnType<typeof getDb>, project: { owner_id: string; member_role?: string } | undefined, projectId: string, userId: string) {
  if (!project) return false;
  if (project.owner_id === userId) return true;
  return requireProjectPermission(db, projectId, userId, 'manage_members');
}

function projectMembers(db: ReturnType<typeof getDb>, projectId: string) {
  return db.prepare(`
    SELECT m.id, m.role, u.id AS user_id, u.email, u.name, u.avatar_url
    FROM project_members m
    JOIN users u ON m.user_id = u.id
    WHERE m.project_id = ?
    ORDER BY m.created_at ASC
  `).all(projectId).map((member: any) => ({
    id: member.id,
    role: member.role,
    user: {
      id: member.user_id,
      email: member.email,
      name: member.name,
      avatar_url: member.avatar_url,
    },
  }));
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const project = getProjectManager(db, params.id, user.id);
    if (!canManageMembers(db, project, params.id, user.id)) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as { user_id?: string; role?: string };
    const userId = body.user_id?.trim();
    const role = normalizeRole(body.role);
    if (!projectRoleExists(db, role)) {
      return NextResponse.json({ error: '存在しないプロジェクトロールです' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'ユーザーを選択してください' }, { status: 400 });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
    if (!existingUser) {
      return NextResponse.json({ error: '登録済みユーザーが見つかりません' }, { status: 404 });
    }
    if (existingUser.id === project?.owner_id) {
      return NextResponse.json({ error: 'オーナーは既にプロジェクトに含まれています' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO project_members (id, project_id, user_id, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
    `).run(uuidv4(), params.id, existingUser.id, role);

    return NextResponse.json({ members: projectMembers(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const project = getProjectManager(db, params.id, user.id);
    if (!canManageMembers(db, project, params.id, user.id)) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as { user_id?: string; role?: string };
    const role = normalizeRole(body.role);
    if (!projectRoleExists(db, role)) {
      return NextResponse.json({ error: '存在しないプロジェクトロールです' }, { status: 400 });
    }
    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id が必要です' }, { status: 400 });
    }

    db.prepare(`
      UPDATE project_members
      SET role = ?
      WHERE project_id = ? AND user_id = ?
    `).run(role, params.id, body.user_id);

    return NextResponse.json({ members: projectMembers(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const project = getProjectManager(db, params.id, user.id);
    if (!canManageMembers(db, project, params.id, user.id)) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id が必要です' }, { status: 400 });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(params.id, userId);
      db.prepare('UPDATE projects SET primary_assignee_id = NULL WHERE id = ? AND primary_assignee_id = ?').run(params.id, userId);
    });
    tx();

    return NextResponse.json({ members: projectMembers(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
