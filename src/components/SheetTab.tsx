'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { withBasePath } from '@/lib/paths';

export interface SheetColumn { id: string; name: string; }
export interface SheetRowData { id: string; cells: Record<string, string>; }
export interface ProjectSheet {
  id: string;
  project_id: string;
  name: string;
  columns_def: SheetColumn[];
  rows_data: SheetRowData[];
}

const MIN_COL_WIDTH = 100;
const DEFAULT_COL_WIDTH = 160;

// ─── セル ───────────────────────────────────────────────
function Cell({ value, onChange, onTab, onEnter, onArrow, focused, onFocus }: {
  value: string;
  onChange: (v: string) => void;
  onTab: (shift: boolean) => void;
  onEnter: (shift: boolean) => void;
  onArrow: (dir: 'up' | 'down' | 'left' | 'right') => void;
  focused: boolean;
  onFocus: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focused) ref.current?.focus(); }, [focused]);

  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={onFocus}
      onKeyDown={e => {
        if (e.key === 'Tab') { e.preventDefault(); onTab(e.shiftKey); }
        else if (e.key === 'Enter') { e.preventDefault(); onEnter(e.shiftKey); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onArrow('up'); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onArrow('down'); }
      }}
      style={{
        width: '100%', height: '100%', border: 'none', outline: 'none',
        padding: '0 8px', fontSize: '0.8125rem', background: 'transparent',
        color: 'var(--text-primary)',
      }}
    />
  );
}

// ─── シート本体 ─────────────────────────────────────────
function SheetGrid({ sheet, onUpdate }: { sheet: ProjectSheet; onUpdate: (s: ProjectSheet) => void }) {
  const [focused, setFocused] = useState<{ row: number; col: number } | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colEditValue, setColEditValue] = useState('');

  const cols = sheet.columns_def;
  const rows = sheet.rows_data;

  function updateCell(rowIdx: number, colId: string, val: string) {
    const nextRows = rows.map((r, i) => i === rowIdx ? { ...r, cells: { ...r.cells, [colId]: val } } : r);
    onUpdate({ ...sheet, rows_data: nextRows });
  }

  function addRow() {
    const newRow: SheetRowData = { id: uuidv4(), cells: {} };
    onUpdate({ ...sheet, rows_data: [...rows, newRow] });
    setFocused({ row: rows.length, col: 0 });
  }

  function deleteRow(idx: number) {
    onUpdate({ ...sheet, rows_data: rows.filter((_, i) => i !== idx) });
    setFocused(null);
  }

  function addCol() {
    const newCol: SheetColumn = { id: uuidv4(), name: `列${cols.length + 1}` };
    onUpdate({ ...sheet, columns_def: [...cols, newCol] });
  }

  function deleteCol(colId: string) {
    onUpdate({
      ...sheet,
      columns_def: cols.filter(c => c.id !== colId),
      rows_data: rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }),
    });
  }

  function renameCol(colId: string, name: string) {
    onUpdate({ ...sheet, columns_def: cols.map(c => c.id === colId ? { ...c, name } : c) });
    setEditingColId(null);
  }

  function moveFocus(row: number, col: number) {
    const r = Math.max(0, Math.min(rows.length - 1, row));
    const c = Math.max(0, Math.min(cols.length - 1, col));
    setFocused({ row: r, col: c });
  }

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    background: 'var(--surface-secondary, #f8fafc)',
    borderBottom: '2px solid var(--border)',
    borderRight: '1px solid var(--border)',
    padding: 0, userSelect: 'none',
    minWidth: MIN_COL_WIDTH, width: DEFAULT_COL_WIDTH,
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 36 }} />
          {cols.map(c => <col key={c.id} style={{ width: DEFAULT_COL_WIDTH }} />)}
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr>
            {/* 行番号ヘッダー */}
            <th style={{ ...thBase, width: 36, minWidth: 36 }} />
            {cols.map((col, ci) => (
              <th key={col.id} style={thBase}>
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    value={colEditValue}
                    onChange={e => setColEditValue(e.target.value)}
                    onBlur={() => renameCol(col.id, colEditValue || col.name)}
                    onKeyDown={e => { if (e.key === 'Enter') renameCol(col.id, colEditValue || col.name); if (e.key === 'Escape') setEditingColId(null); }}
                    style={{ width: '100%', border: 'none', outline: 'none', padding: '6px 8px', fontSize: '0.75rem', fontWeight: 600, background: 'transparent' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 6px 8px', gap: 2 }}>
                    <span
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', flex: 1, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onDoubleClick={() => { setEditingColId(col.id); setColEditValue(col.name); }}
                    >{col.name}</span>
                    {cols.length > 1 && (
                      <button onClick={() => deleteCol(col.id)} title="列を削除"
                        style={{ opacity: 0.4, fontSize: '0.625rem', lineHeight: 1, padding: '2px 3px', cursor: 'pointer', border: 'none', background: 'none', color: 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                      >✕</button>
                    )}
                  </div>
                )}
              </th>
            ))}
            {/* 列追加 */}
            <th style={{ ...thBase, width: 36, minWidth: 36 }}>
              <button onClick={addCol} title="列を追加"
                style={{ width: '100%', height: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(15,154,177,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* 行番号 */}
              <td style={{ textAlign: 'center', fontSize: '0.625rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border)', width: 36, userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span>{ri + 1}</span>
                  <button onClick={() => deleteRow(ri)} title="行を削除"
                    style={{ opacity: 0, fontSize: '0.5rem', cursor: 'pointer', border: 'none', background: 'none', color: 'var(--text-muted)', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >✕</button>
                </div>
              </td>
              {cols.map((col, ci) => {
                const isFocused = focused?.row === ri && focused?.col === ci;
                return (
                  <td key={col.id} style={{
                    height: 32, borderRight: '1px solid var(--border)', padding: 0,
                    outline: isFocused ? '2px solid var(--accent)' : 'none',
                    outlineOffset: -2,
                  }}>
                    <Cell
                      value={row.cells[col.id] ?? ''}
                      onChange={v => updateCell(ri, col.id, v)}
                      focused={isFocused}
                      onFocus={() => setFocused({ row: ri, col: ci })}
                      onTab={shift => moveFocus(ri, shift ? ci - 1 : ci + 1)}
                      onEnter={shift => moveFocus(shift ? ri - 1 : ri + 1, ci)}
                      onArrow={dir => {
                        if (dir === 'up') moveFocus(ri - 1, ci);
                        else if (dir === 'down') moveFocus(ri + 1, ci);
                        else if (dir === 'left') moveFocus(ri, ci - 1);
                        else moveFocus(ri, ci + 1);
                      }}
                    />
                  </td>
                );
              })}
              <td style={{ width: 36, borderRight: '1px solid var(--border)' }} />
            </tr>
          ))}
          {/* 行追加 */}
          <tr>
            <td colSpan={cols.length + 2} style={{ padding: 0 }}>
              <button onClick={addRow}
                style={{ width: '100%', padding: '6px', fontSize: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', textAlign: 'left', paddingLeft: 12 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(15,154,177,0.04)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >+ 行を追加</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── エクスポート ────────────────────────────────────────
function exportCsv(sheet: ProjectSheet) {
  const header = sheet.columns_def.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',');
  const body = sheet.rows_data.map(row =>
    sheet.columns_def.map(c => `"${(row.cells[c.id] ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${sheet.name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function exportXlsx(sheet: ProjectSheet) {
  const { utils, writeFile } = await import('xlsx');
  const aoa = [
    sheet.columns_def.map(c => c.name),
    ...sheet.rows_data.map(row => sheet.columns_def.map(c => row.cells[c.id] ?? '')),
  ];
  const ws = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  writeFile(wb, `${sheet.name}.xlsx`);
}

// ─── タブ本体 ────────────────────────────────────────────
export default function SheetTab({ projectId }: { projectId: string }) {
  const [sheets, setSheets] = useState<ProjectSheet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabNameValue, setTabNameValue] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`));
    const data = await res.json() as ProjectSheet[];
    setSheets(data);
    if (data.length > 0 && !activeId) setActiveId(data[0].id);
    setLoading(false);
  }, [projectId, activeId]);

  useEffect(() => { load(); }, [load]);

  async function createSheet() {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const sheet = await res.json() as ProjectSheet;
    setSheets(prev => [...prev, sheet]);
    setActiveId(sheet.id);
  }

  async function deleteSheet(sheetId: string) {
    if (!confirm('このシートを削除しますか？')) return;
    await fetch(withBasePath(`/api/projects/${projectId}/sheets/${sheetId}`), { method: 'DELETE' });
    setSheets(prev => {
      const next = prev.filter(s => s.id !== sheetId);
      if (activeId === sheetId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function updateSheet(updated: ProjectSheet) {
    setSheets(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await fetch(withBasePath(`/api/projects/${projectId}/sheets/${updated.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, columns_def: updated.columns_def, rows_data: updated.rows_data }),
      });
      setSaving(false);
    }, 600);
  }

  async function renameSheet(sheetId: string, name: string) {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet || !name.trim()) { setEditingTabId(null); return; }
    const updated = { ...sheet, name: name.trim() };
    updateSheet(updated);
    setEditingTabId(null);
  }

  const activeSheet = sheets.find(s => s.id === activeId) ?? null;

  if (loading) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* シートタブ + ツールバー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {sheets.map(s => (
            <div key={s.id} className="flex items-center"
              style={{ borderRadius: 8, border: '1px solid', borderColor: activeId === s.id ? 'var(--accent)' : 'var(--border)', background: activeId === s.id ? 'var(--accent-soft)' : 'white' }}
            >
              {editingTabId === s.id ? (
                <input
                  autoFocus
                  value={tabNameValue}
                  onChange={e => setTabNameValue(e.target.value)}
                  onBlur={() => renameSheet(s.id, tabNameValue)}
                  onKeyDown={e => { if (e.key === 'Enter') renameSheet(s.id, tabNameValue); if (e.key === 'Escape') setEditingTabId(null); }}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', border: 'none', outline: 'none', background: 'transparent', width: 120 }}
                />
              ) : (
                <button
                  onClick={() => setActiveId(s.id)}
                  onDoubleClick={() => { setEditingTabId(s.id); setTabNameValue(s.name); }}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: activeId === s.id ? 600 : 400, color: activeId === s.id ? 'var(--accent)' : 'var(--text-secondary)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 7 }}
                >{s.name}</button>
              )}
              {sheets.length > 1 && (
                <button onClick={() => deleteSheet(s.id)} title="シートを削除"
                  style={{ padding: '2px 6px 2px 0', fontSize: '0.625rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >✕</button>
              )}
            </div>
          ))}
          <button onClick={createSheet}
            style={{ padding: '4px 10px', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >+ シートを追加</button>
        </div>

        {/* エクスポート + 保存中 */}
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>保存中...</span>}
          {activeSheet && (
            <>
              <button onClick={() => exportCsv(activeSheet)} className="btn-secondary text-xs flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
              <button onClick={() => exportXlsx(activeSheet)} className="btn-secondary text-xs flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* シートが空の場合 */}
      {sheets.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm mb-3">シートがありません</p>
          <button onClick={createSheet} className="btn-primary text-sm">最初のシートを作成</button>
        </div>
      ) : activeSheet ? (
        <SheetGrid
          sheet={activeSheet}
          onUpdate={updated => updateSheet(updated)}
        />
      ) : null}

      <p className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
        列ヘッダーをダブルクリックで名前変更 · Tab/Enter でセル移動 · 矢印キーで移動
      </p>
    </div>
  );
}
