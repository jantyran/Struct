import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from '@/types';

export async function GET() {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as {
    name: string;
    type?: string;
    target?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
    channels?: string[];
    description?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name は必須です' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, name, type, target, start_date, end_date, budget, channels, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name.trim(),
    body.type ?? 'campaign',
    body.target ?? '',
    body.start_date ?? '',
    body.end_date ?? '',
    body.budget ?? '',
    JSON.stringify(body.channels ?? []),
    body.description ?? '',
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return NextResponse.json(project, { status: 201 });
}
