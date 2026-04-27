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

const COL_WIDTH = 180;
const ROW_NUM_WIDTH = 44;
const ADD_COL_WIDTH = 44;
const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 36;

const COLOR = {
  headerBg: '#f1f5f9',
  headerText: '#475569',
  border: '#e2e8f0',
  rowAlt: '#f8fafc',
  rowHover: '#f0f9ff',
  cellBg: '#ffffff',
  focusBorder: 'var(--accent)',
  addBtnHover: '#e0f2fe',
  rowNumBg: '#f8fafc',
  rowNumText: '#94a3b8',
  mutedText: '#94a3b8',
};

// ─── セル入力 ───────────────────────────────────────────
function CellInput({ value, onChange, onTab, onEnter, onArrow, focused, onFocus }: {
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
        else if (e.key === 'ArrowUp' && !e.shiftKey) { e.preventDefault(); onArrow('up'); }
        else if (e.key === 'ArrowDown' && !e.shiftKey) { e.preventDefault(); onArrow('down'); }
      }}
      style={{
        width: '100%', height: '100%', border: 'none', outline: 'none',
        padding: '0 10px', fontSize: '0.8125rem', background: 'transparent',
        color: '#1e293b', lineHeight: 1.4,
      }}
    />
  );
}

// ─── グリッド ─────────────────────────────────────────────
function SheetGrid({ sheet, onUpdate }: { sheet: ProjectSheet; onUpdate: (s: ProjectSheet) => void }) {
  const [focused, setFocused] = useState<{ row: number; col: number } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colEditValue, setColEditValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const cols = sheet.columns_def;
  const rows = sheet.rows_data;

  function updateCell(ri: number, colId: string, val: string) {
    const nextRows = rows.map((r, i) => i === ri ? { ...r, cells: { ...r.cells, [colId]: val } } : r);
    onUpdate({ ...sheet, rows_data: nextRows });
  }

  function addRow() {
    const newRow: SheetRowData = { id: uuidv4(), cells: {} };
    onUpdate({ ...sheet, rows_data: [...rows, newRow] });
    setTimeout(() => setFocused({ row: rows.length, col: 0 }), 50);
  }

  function deleteRow(idx: number) {
    onUpdate({ ...sheet, rows_data: rows.filter((_, i) => i !== idx) });
    setFocused(null);
    setHoveredRow(null);
  }

  function addCol() {
    const newCol: SheetColumn = { id: uuidv4(), name: `列 ${cols.length + 1}` };
    onUpdate({ ...sheet, columns_def: [...cols, newCol] });
  }

  function deleteCol(colId: string) {
    onUpdate({
      ...sheet,
      columns_def: cols.filter(c => c.id !== colId),
      rows_data: rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }),
    });
    setFocused(null);
  }

  function startRenameCol(col: SheetColumn) {
    setEditingColId(col.id);
    setColEditValue(col.name);
  }

  function commitRenameCol(colId: string) {
    const name = colEditValue.trim();
    onUpdate({ ...sheet, columns_def: cols.map(c => c.id === colId ? { ...c, name: name || c.name } : c) });
    setEditingColId(null);
  }

  function moveFocus(row: number, col: number) {
    setFocused({
      row: Math.max(0, Math.min(rows.length - 1, row)),
      col: Math.max(0, Math.min(cols.length - 1, col)),
    });
  }

  // コンテナ外クリックでフォーカス解除
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(null);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const totalWidth = ROW_NUM_WIDTH + cols.length * COL_WIDTH + ADD_COL_WIDTH;

  return (
    <div ref={containerRef}
      style={{
        overflowX: 'auto', overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
        borderRadius: 10,
        border: `1px solid ${COLOR.border}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        background: COLOR.cellBg,
      }}
    >
      <table style={{ borderCollapse: 'collapse', minWidth: totalWidth, tableLayout: 'fixed', width: totalWidth }}>
        <colgroup>
          <col style={{ width: ROW_NUM_WIDTH }} />
          {cols.map(c => <col key={c.id} style={{ width: COL_WIDTH }} />)}
          <col style={{ width: ADD_COL_WIDTH }} />
        </colgroup>

        {/* ヘッダー行 */}
        <thead>
          <tr>
            <th style={{
              position: 'sticky', top: 0, zIndex: 3,
              width: ROW_NUM_WIDTH, height: HEADER_HEIGHT,
              background: COLOR.headerBg,
              borderBottom: `2px solid ${COLOR.border}`,
              borderRight: `1px solid ${COLOR.border}`,
            }} />
            {cols.map((col, ci) => (
              <th key={col.id} style={{
                position: 'sticky', top: 0, zIndex: 2,
                height: HEADER_HEIGHT, padding: 0,
                background: COLOR.headerBg,
                borderBottom: `2px solid ${COLOR.border}`,
                borderRight: `1px solid ${COLOR.border}`,
                userSelect: 'none',
              }}>
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    value={colEditValue}
                    onChange={e => setColEditValue(e.target.value)}
                    onBlur={() => commitRenameCol(col.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRenameCol(col.id);
                      if (e.key === 'Escape') setEditingColId(null);
                    }}
                    style={{
                      width: '100%', height: '100%', border: 'none', padding: '0 10px',
                      fontSize: '0.75rem', fontWeight: 600, background: '#e0f2fe',
                      color: COLOR.headerText, outline: 'none',
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px 0 10px', gap: 4 }}>
                    <span
                      title="ダブルクリックで名前変更"
                      onDoubleClick={() => startRenameCol(col)}
                      style={{
                        flex: 1, fontSize: '0.75rem', fontWeight: 600,
                        color: COLOR.headerText, cursor: 'text',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{col.name}</span>
                    {cols.length > 1 && (
                      <button
                        onClick={() => deleteCol(col.id)}
                        title="列を削除"
                        style={{
                          flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          color: COLOR.mutedText, fontSize: '0.6875rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLOR.mutedText; }}
                      >✕</button>
                    )}
                  </div>
                )}
              </th>
            ))}
            {/* 列追加ボタン */}
            <th style={{
              position: 'sticky', top: 0, zIndex: 2,
              width: ADD_COL_WIDTH, height: HEADER_HEIGHT,
              background: COLOR.headerBg,
              borderBottom: `2px solid ${COLOR.border}`,
              padding: 0,
            }}>
              <button
                onClick={addCol}
                title="列を追加"
                style={{
                  width: '100%', height: '100%', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: '1.1rem', color: COLOR.mutedText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = COLOR.addBtnHover; }}
                onMouseLeave={e => { e.currentTarget.style.color = COLOR.mutedText; e.currentTarget.style.background = 'transparent'; }}
              >+</button>
            </th>
          </tr>
        </thead>

        {/* データ行 */}
        <tbody>
          {rows.map((row, ri) => {
            const isHovered = hoveredRow === ri;
            const rowBg = isHovered ? COLOR.rowHover : ri % 2 === 1 ? COLOR.rowAlt : COLOR.cellBg;
            return (
              <tr
                key={row.id}
                onMouseEnter={() => setHoveredRow(ri)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{ background: rowBg, transition: 'background 0.1s' }}
              >
                {/* 行番号 */}
                <td style={{
                  width: ROW_NUM_WIDTH, height: ROW_HEIGHT,
                  background: isHovered ? '#e0f2fe' : COLOR.rowNumBg,
                  borderBottom: `1px solid ${COLOR.border}`,
                  borderRight: `1px solid ${COLOR.border}`,
                  textAlign: 'center', userSelect: 'none',
                  position: 'relative', transition: 'background 0.1s',
                }}>
                  {isHovered ? (
                    <button
                      onClick={() => deleteRow(ri)}
                      title="行を削除"
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6875rem', color: '#64748b',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.625rem', color: COLOR.rowNumText }}>{ri + 1}</span>
                  )}
                </td>

                {/* データセル */}
                {cols.map((col, ci) => {
                  const isFocused = focused?.row === ri && focused?.col === ci;
                  return (
                    <td key={col.id} style={{
                      height: ROW_HEIGHT, padding: 0,
                      borderBottom: `1px solid ${COLOR.border}`,
                      borderRight: `1px solid ${COLOR.border}`,
                      boxShadow: isFocused ? `inset 0 0 0 2px var(--accent)` : 'none',
                      background: isFocused ? 'rgba(15,154,177,0.04)' : 'transparent',
                      position: 'relative',
                    }}>
                      <CellInput
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
                <td style={{ borderBottom: `1px solid ${COLOR.border}` }} />
              </tr>
            );
          })}

          {/* 行追加 */}
          <tr>
            <td colSpan={cols.length + 2} style={{ padding: 0 }}>
              <button
                onClick={addRow}
                style={{
                  width: '100%', padding: '7px 0 7px 12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.75rem', color: COLOR.mutedText,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = COLOR.addBtnHover; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLOR.mutedText; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                行を追加
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── エクスポート ─────────────────────────────────────────
function exportCsv(sheet: ProjectSheet) {
  const header = sheet.columns_def.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',');
  const body = sheet.rows_data.map(row =>
    sheet.columns_def.map(c => `"${(row.cells[c.id] ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), `${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
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

function makeDefaultSheet(): { columns_def: SheetColumn[]; rows_data: SheetRowData[] } {
  const cols: SheetColumn[] = ['列 1', '列 2', '列 3', '列 4'].map(name => ({ id: uuidv4(), name }));
  const rows: SheetRowData[] = Array.from({ length: 8 }, () => ({ id: uuidv4(), cells: {} }));
  return { columns_def: cols, rows_data: rows };
}

// ─── タブ本体 ─────────────────────────────────────────────
export default function SheetTab({ projectId }: { projectId: string }) {
  const [sheets, setSheets] = useState<ProjectSheet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabNameValue, setTabNameValue] = useState('');

  const loadOnce = useRef(false);
  const load = useCallback(async () => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`));
    const data = await res.json() as ProjectSheet[];
    setSheets(data);
    if (data.length > 0) setActiveId(prev => prev ?? data[0].id);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (loadOnce.current) return;
    loadOnce.current = true;
    load();
  }, [load]);

  async function createSheet() {
    const defaults = makeDefaultSheet();
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `シート ${sheets.length + 1}` }),
    });
    const sheet = await res.json() as ProjectSheet;
    // デフォルト列・行を即保存
    const withDefaults = { ...sheet, ...defaults };
    await fetch(withBasePath(`/api/projects/${projectId}/sheets/${sheet.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns_def: defaults.columns_def, rows_data: defaults.rows_data }),
    });
    setSheets(prev => [...prev, withDefaults]);
    setActiveId(withDefaults.id);
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
    setSaved(false);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await fetch(withBasePath(`/api/projects/${projectId}/sheets/${updated.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, columns_def: updated.columns_def, rows_data: updated.rows_data }),
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 600);
  }

  async function renameSheet(sheetId: string, name: string) {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) { setEditingTabId(null); return; }
    const updated = { ...sheet, name: name.trim() || sheet.name };
    updateSheet(updated);
    setEditingTabId(null);
  }

  const activeSheet = sheets.find(s => s.id === activeId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* ツールバー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: `1px solid ${COLOR.border}`,
        background: '#fafbfc', gap: 12, flexWrap: 'wrap',
      }}>
        {/* シートタブ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {sheets.map(s => {
            const isActive = activeId === s.id;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 7,
                border: `1px solid ${isActive ? 'var(--accent)' : COLOR.border}`,
                background: isActive ? 'var(--accent-soft)' : '#ffffff',
                transition: 'all 0.15s',
              }}>
                {editingTabId === s.id ? (
                  <input
                    autoFocus
                    value={tabNameValue}
                    onChange={e => setTabNameValue(e.target.value)}
                    onBlur={() => renameSheet(s.id, tabNameValue)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameSheet(s.id, tabNameValue);
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    style={{
                      padding: '4px 8px', fontSize: '0.75rem', border: 'none',
                      outline: 'none', background: 'transparent', width: 120,
                      color: 'var(--accent)',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setActiveId(s.id)}
                    onDoubleClick={() => { setEditingTabId(s.id); setTabNameValue(s.name); }}
                    title="ダブルクリックで名前変更"
                    style={{
                      padding: '4px 10px', fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : COLOR.headerText,
                      border: 'none', background: 'none', cursor: 'pointer',
                    }}
                  >{s.name}</button>
                )}
                {sheets.length > 1 && (
                  <button
                    onClick={() => deleteSheet(s.id)}
                    title="シートを削除"
                    style={{
                      padding: '4px 7px 4px 0', fontSize: '0.6875rem',
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: COLOR.mutedText, lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = COLOR.mutedText)}
                  >✕</button>
                )}
              </div>
            );
          })}
          <button
            onClick={createSheet}
            style={{
              padding: '4px 10px', fontSize: '0.75rem',
              border: `1px dashed ${COLOR.border}`, borderRadius: 7,
              background: 'none', cursor: 'pointer', color: COLOR.mutedText,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = COLOR.mutedText; e.currentTarget.style.borderColor = COLOR.border; }}
          >+ シートを追加</button>
        </div>

        {/* 右側: 保存状態 + エクスポート */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && (
            <span style={{ fontSize: '0.75rem', color: COLOR.mutedText, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
              保存中
            </span>
          )}
          {saved && !saving && (
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              保存済み
            </span>
          )}
          {activeSheet && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => exportCsv(activeSheet)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', fontSize: '0.75rem', fontWeight: 500,
                  border: `1px solid ${COLOR.border}`, borderRadius: 7,
                  background: '#ffffff', cursor: 'pointer', color: COLOR.headerText,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.headerText; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
              <button
                onClick={() => exportXlsx(activeSheet)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', fontSize: '0.75rem', fontWeight: 500,
                  border: `1px solid ${COLOR.border}`, borderRadius: 7,
                  background: '#ffffff', cursor: 'pointer', color: COLOR.headerText,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.headerText; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* グリッドエリア */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {sheets.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 64, color: COLOR.mutedText }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 12px', opacity: 0.35 }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>シートがまだありません</p>
            <button onClick={createSheet} className="btn-primary text-sm">最初のシートを作成</button>
          </div>
        ) : activeSheet ? (
          <SheetGrid sheet={activeSheet} onUpdate={updateSheet} />
        ) : null}
      </div>

      {/* フッター ヒント */}
      {activeSheet && (
        <div style={{
          padding: '6px 16px', borderTop: `1px solid ${COLOR.border}`,
          background: '#fafbfc', display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          {[
            'ダブルクリックで列名変更',
            'Tab / Shift+Tab で横移動',
            'Enter / ↑↓ で縦移動',
            '行にホバーで行削除',
          ].map(hint => (
            <span key={hint} style={{ fontSize: '0.625rem', color: COLOR.mutedText }}>{hint}</span>
          ))}
        </div>
      )}
    </div>
  );
}
