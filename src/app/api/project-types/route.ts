import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeProjectTypeDefinitions, normalizeProjectTypeDefinitionsRow, serializeProjectTypeDefinitions } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import type { CustomField } from '@/types';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    let assets = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id) as any;

    if (!assets) {
      const id = uuidv4();
      db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(id, user.id);
      assets = db.prepare('SELECT * FROM global_assets WHERE id = ?').get(id);
    }

    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(assets) });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { project_types?: unknown };
    const definitions = normalizeProjectTypeDefinitions(body.project_types as any[]);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE global_assets SET
          project_types = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `).run(serializeProjectTypeDefinitions(definitions), user.id);

      const ownedProjects = db.prepare('SELECT id, type FROM projects WHERE owner_id = ?').all(user.id) as Array<{ id: string; type: string }>;
      for (const project of ownedProjects) {
        const existingFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(project.id) as CustomField[];
        const definition = definitions.find((item) => item.key === project.type);
        const syncedFields = syncCustomFieldsWithDefinition(project.id, existingFields, definition);
        persistProjectCustomFields(db, project.id, syncedFields);
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id) as any;
    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(updated) });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
