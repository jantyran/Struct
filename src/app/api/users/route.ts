import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { hasSystemPermission, systemRoleDefinitions, systemRoleExists } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const currentUser = await requireSession();
    const db = getDb();
    const canManageUsers = hasSystemPermission(db, currentUser.id, 'manage_users');
    const users = db.prepare(`
      SELECT id, email, name, avatar_url, system_role, created_at
      FROM users
      ${canManageUsers ? '' : 'WHERE id = ?'}
      ORDER BY COALESCE(NULLIF(name, ''), email) ASC
    `).all(...(canManageUsers ? [] : [currentUser.id]));

    return NextResponse.json({
      users,
      roles: systemRoleDefinitions(db),
      can_manage_users: canManageUsers,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireSession();
    const db = getDb();
    const canManageUsers = hasSystemPermission(db, currentUser.id, 'manage_users');
    const body = await request.json() as { user_id?: string; name?: string; avatar_url?: string; system_role?: string };
    const targetUserId = canManageUsers && body.user_id ? body.user_id : currentUser.id;
    const target = db.prepare('SELECT id, system_role FROM users WHERE id = ?').get(targetUserId) as { id: string; system_role: string } | undefined;
    if (!target) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : '';
    const nextSystemRole = canManageUsers && body.system_role ? body.system_role : target.system_role;
    if (!systemRoleExists(db, nextSystemRole)) {
      return NextResponse.json({ error: '存在しないシステムロールです' }, { status: 400 });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, avatar_url = ?, system_role = ?
      WHERE id = ?
    `).run(name, avatarUrl, nextSystemRole, targetUserId);

    const updated = db.prepare(`
      SELECT id, email, name, avatar_url, system_role
      FROM users
      WHERE id = ?
    `).get(targetUserId);

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, currentUser.id, 'manage_users')) {
      return NextResponse.json({ error: 'ユーザー管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as {
      email?: string;
      password?: string;
      name?: string;
      avatar_url?: string;
      system_role?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    const systemRole = body.system_role || 'USER';

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスと初期パスワードが必要です' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'パスワードは6文字以上にしてください' }, { status: 400 });
    }
    if (!systemRoleExists(db, systemRole)) {
      return NextResponse.json({ error: '存在しないシステムロールです' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, avatar_url, system_role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        email,
        passwordHash,
        body.name?.trim() || null,
        body.avatar_url?.trim() || '',
        systemRole,
      );
      db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(uuidv4(), id);
    });
    tx();

    const created = db.prepare(`
      SELECT id, email, name, avatar_url, system_role, created_at
      FROM users
      WHERE id = ?
    `).get(id);

    return NextResponse.json({ user: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, currentUser.id, 'manage_users')) {
      return NextResponse.json({ error: 'ユーザー管理権限がありません' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id が必要です' }, { status: 400 });
    }
    if (userId === currentUser.id) {
      return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 });
    }

    const target = db.prepare('SELECT id, system_role FROM users WHERE id = ?').get(userId) as { id: string; system_role: string } | undefined;
    if (!target) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });

    if (target.system_role === 'SYSTEM_ADMIN') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE system_role = 'SYSTEM_ADMIN'").get() as { count: number };
      if (adminCount.count <= 1) {
        return NextResponse.json({ error: '最後のシステム管理者は削除できません' }, { status: 400 });
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
