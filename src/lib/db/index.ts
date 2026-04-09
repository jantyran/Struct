import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'struct.json');

interface Schema {
  global_assets: Record<string, any>;
  projects: any[];
  custom_fields: any[];
  generated_assets: any[];
}

function read(): Schema {
  if (!fs.existsSync(DB_FILE)) {
    const initial: Schema = {
      global_assets: { 
        id: 'main', 
        company_name: '', 
        company_description: '', 
        brand_voice: '', 
        brand_guidelines: '', 
        products: '[]',
        updated_at: new Date().toISOString()
      },
      projects: [],
      custom_fields: [],
      generated_assets: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Failed to read DB file, returning empty state', e);
    return { global_assets: { id: 'main' }, projects: [], custom_fields: [], generated_assets: [] } as any;
  }
}

function write(data: Schema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Mimic a subset of better-sqlite3 for easier refactoring
export function getDb() {
  const data = read();
  return {
    prepare: (sql: string) => {
      const q = sql.toLowerCase().trim();
      return {
        all: (...params: any[]) => {
          if (q.includes('from global_assets')) return [data.global_assets];
          if (q.includes('from projects')) {
            let res = [...data.projects];
            if (q.includes('order by updated_at desc')) res.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            return res;
          }
          if (q.includes('from custom_fields')) {
            const projectId = params[0];
            return data.custom_fields
              .filter(f => f.project_id === projectId)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          }
          if (q.includes('from generated_assets')) {
            const projectId = params[0];
            return data.generated_assets
              .filter(a => a.project_id === projectId)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
          return [];
        },
        get: (...params: any[]) => {
          if (q.includes('from global_assets')) return data.global_assets;
          if (q.includes('from projects')) {
            const id = params[0];
            return data.projects.find(p => p.id === id);
          }
          if (q.includes('from custom_fields')) {
            const [id, projectId] = params;
            if (projectId) return data.custom_fields.find(f => f.id === id && f.project_id === projectId);
            return data.custom_fields.find(f => f.id === id);
          }
          return null;
        },
        run: (...params: any[]) => {
          const now = new Date().toISOString();
          if (q.startsWith('insert into projects')) {
            if (params.length === 10) {
              const [id, name, type, cloned_from, target, start_date, end_date, budget, channels, description] = params;
              data.projects.push({ id, name, type, status: 'draft', cloned_from, target, start_date, end_date, budget, channels, description, created_at: now, updated_at: now });
            } else {
              const [id, name, type, target, start_date, end_date, budget, channels, description] = params;
              data.projects.push({ id, name, type, status: 'draft', target, start_date, end_date, budget, channels, description, created_at: now, updated_at: now });
            }
          } else if (q.startsWith('update projects')) {
            const [name, type, status, target, start_date, end_date, budget, channels, description, id] = params;
            const idx = data.projects.findIndex(p => p.id === id);
            if (idx !== -1) {
              const p = data.projects[idx];
              data.projects[idx] = {
                ...p,
                name: name ?? p.name,
                type: type ?? p.type,
                status: status ?? p.status,
                target: target ?? p.target,
                start_date: start_date ?? p.start_date,
                end_date: end_date ?? p.end_date,
                budget: budget ?? p.budget,
                channels: channels ?? p.channels,
                description: description ?? p.description,
                updated_at: now
              };
            }
          } else if (q.startsWith('delete from projects')) {
            const id = params[0];
            data.projects = data.projects.filter(p => p.id !== id);
            data.custom_fields = data.custom_fields.filter(f => f.project_id !== id);
            data.generated_assets = data.generated_assets.filter(a => a.project_id !== id);
          } else if (q.startsWith('insert into custom_fields')) {
            // id, project_id, key, label, type, value, options, sort_order
            // OR with inherited/inherited_from
            if (params.length === 10) {
              const [id, project_id, key, label, type, value, options, inherited, inherited_from, sort_order] = params;
              data.custom_fields.push({ id, project_id, key, label, type, value, options, inherited, inherited_from, sort_order, crawled_content: null });
            } else {
              const [id, project_id, key, label, type, value, options, sort_order] = params;
              data.custom_fields.push({ id, project_id, key, label, type, value, options, inherited: 0, inherited_from: null, sort_order, crawled_content: null });
            }
          } else if (q.startsWith('update custom_fields set crawled_content')) {
            const [content, id] = params;
            const idx = data.custom_fields.findIndex(f => f.id === id);
            if (idx !== -1) data.custom_fields[idx].crawled_content = content;
          } else if (q.startsWith('update custom_fields')) {
            const [key, label, type, value, options, sort_order, id, project_id] = params;
            const idx = data.custom_fields.findIndex(f => f.id === id && f.project_id === project_id);
            if (idx !== -1) {
              const f = data.custom_fields[idx];
              data.custom_fields[idx] = { ...f, key, label, type, value, options, sort_order };
            }
          } else if (q.startsWith('delete from custom_fields')) {
            const id = params[0];
            data.custom_fields = data.custom_fields.filter(f => f.id !== id);
          } else if (q.startsWith('update global_assets')) {
            const [name, desc, voice, guidelines, products] = params;
            data.global_assets = { ...data.global_assets, company_name: name, company_description: desc, brand_voice: voice, brand_guidelines: guidelines, products, updated_at: now };
          } else if (q.startsWith('insert into generated_assets')) {
            const [id, project_id, asset_type, title, content, warnings] = params;
            data.generated_assets.push({ id, project_id, asset_type, title, content, warnings, created_at: now });
          } else if (q.startsWith('delete from generated_assets')) {
            if (q.includes('where project_id = ?')) {
              const projectId = params[0];
              data.generated_assets = data.generated_assets.filter(a => a.project_id !== projectId);
            } else {
              const [id, projectId] = params;
              data.generated_assets = data.generated_assets.filter(a => !(a.id === id && a.project_id === projectId));
            }
          }
          write(data);
          return { changes: 1 };
        }
      };
    },
    exec: (sql: string) => {
      // Just for init, already handled by read() initial state
      return;
    },
    pragma: (sql: string) => {
      return;
    }
  };
}
