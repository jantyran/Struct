'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { withBasePath } from '@/lib/paths';

// ─── 型 ──────────────────────────────────────────────────
export interface SheetColumn { id: string; name: string; width?: number; }
export interface SheetRowData { id: string; cells: Record<string, string>; }
export interface ProjectSheet {
  id: string; project_id: string; name: string;
  columns_def: SheetColumn[]; rows_data: SheetRowData[];
}
type CellPos = { row: number; col: number };
type Snap = { columns_def: SheetColumn[]; rows_data: SheetRowData[] };

// ─── 定数 ────────────────────────────────────────────────
const DEFAULT_COL_WIDTH = 160;
const MIN_COL_WIDTH = 48;
const ROW_NUM_W = 48;
const ROW_H = 34;
const HEADER_H = 36;
const MAX_HISTORY = 60;

const C = {
  hBg: '#f1f5f9', hBorder: '#cbd5e1', hText: '#475569',
  border: '#e2e8f0', altRow: '#f8fafc', cell: '#ffffff',
  sel: 'rgba(14,165,233,0.13)', selBorder: '#0ea5e9',
  focus: 'rgba(15,154,177,0.08)', focusBorder: 'var(--accent)',
  muted: '#94a3b8', addHover: '#e0f2fe',
};

// ─── ヘルパー ─────────────────────────────────────────────
function normSel(a: CellPos, b: CellPos) {
  return {
    r0: Math.min(a.row, b.row), r1: Math.max(a.row, b.row),
    c0: Math.min(a.col, b.col), c1: Math.max(a.col, b.col),
  };
}
function inSel(ri: number, ci: number, a: CellPos | null, b: CellPos | null) {
  if (!a || !b) return false;
  const { r0, r1, c0, c1 } = normSel(a, b);
  return ri >= r0 && ri <= r1 && ci >= c0 && ci <= c1;
}
function makeRows(n: number): SheetRowData[] {
  return Array.from({ length: n }, () => ({ id: uuidv4(), cells: {} }));
}
function makeCols(n: number): SheetColumn[] {
  return Array.from({ length: n }, (_, i) => ({ id: uuidv4(), name: `列 ${i + 1}`, width: DEFAULT_COL_WIDTH }));
}

// ─── シート作成モーダル ──────────────────────────────────
function CreateSheetModal({ existingCount, onConfirm, onClose }: {
  existingCount: number;
  onConfirm: (name: string, cols: number, rows: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(`シート ${existingCount + 1}`);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(10);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.18)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="card p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>新しいシートを作成</h3>
        <div className="space-y-3">
          <div>
            <label className="field-label">シート名</label>
            <input className="field-input" value={name} onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && onConfirm(name.trim() || `シート ${existingCount + 1}`, cols, rows)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">列数</label>
              <input type="number" className="field-input" min={1} max={52} value={cols}
                onChange={e => setCols(Math.min(52, Math.max(1, Number(e.target.value))))} />
            </div>
            <div>
              <label className="field-label">行数</label>
              <input type="number" className="field-input" min={1} max={10000} value={rows}
                onChange={e => setRows(Math.min(10000, Math.max(1, Number(e.target.value))))} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={() => onConfirm(name.trim() || `シート ${existingCount + 1}`, cols, rows)} className="btn-primary flex-1">作成</button>
        </div>
      </div>
    </div>
  );
}

// ─── コンテキストメニュー ─────────────────────────────────
interface CtxState { x: number; y: number; ri: number | null; ci: number | null; }
function ContextMenu({ ctx, rows, cols, onClose, onAction }: {
  ctx: CtxState;
  rows: number; cols: number;
  onClose: () => void;
  onAction: (action: string, ri: number | null, ci: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items: { label: string; action: string; show: boolean; danger?: boolean }[] = [
    { label: '上に行を挿入', action: 'insertRowAbove', show: ctx.ri !== null },
    { label: '下に行を挿入', action: 'insertRowBelow', show: ctx.ri !== null },
    { label: 'この行を削除', action: 'deleteRow', show: ctx.ri !== null && rows > 1, danger: true },
    { label: '---', action: '', show: ctx.ri !== null && ctx.ci !== null },
    { label: '左に列を挿入', action: 'insertColLeft', show: ctx.ci !== null },
    { label: '右に列を挿入', action: 'insertColRight', show: ctx.ci !== null },
    { label: 'この列を削除', action: 'deleteCol', show: ctx.ci !== null && cols > 1, danger: true },
  ].filter(i => i.show);

  return (
    <div ref={ref} style={{
      position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 9999,
      background: '#fff', border: `1px solid ${C.border}`,
      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      minWidth: 180, padding: '4px 0', fontSize: '0.8125rem',
    }}>
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} style={{ height: 1, background: C.border, margin: '4px 0' }} />
        ) : (
          <button key={item.action} onClick={() => { onAction(item.action, ctx.ri, ctx.ci); onClose(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 14px', border: 'none', background: 'none',
              cursor: 'pointer', color: item.danger ? '#ef4444' : '#334155',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = item.danger ? '#fff5f5' : C.addHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >{item.label}</button>
        )
      )}
    </div>
  );
}

// ─── セル入力 ────────────────────────────────────────────
function CellInput({ value, onChange, active, onKeyDown, onFocus }: {
  value: string; onChange: (v: string) => void;
  active: boolean; onKeyDown: (e: React.KeyboardEvent) => void; onFocus: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (active) ref.current?.focus(); }, [active]);
  return (
    <input ref={ref} value={value} onChange={e => onChange(e.target.value)}
      onFocus={onFocus} onKeyDown={onKeyDown}
      style={{
        width: '100%', height: '100%', border: 'none', outline: 'none',
        padding: '0 9px', fontSize: '0.8125rem', background: 'transparent',
        color: '#1e293b',
      }}
    />
  );
}

// ─── グリッド ────────────────────────────────────────────
function SheetGrid({ sheet, onUpdate }: { sheet: ProjectSheet; onUpdate: (s: ProjectSheet) => void }) {
  const cols = sheet.columns_def;
  const rows = sheet.rows_data;

  const [anchor, setAnchor] = useState<CellPos | null>(null); // フォーカス + 選択起点
  const [cursor, setCursor] = useState<CellPos | null>(null); // 選択終点
  const [hovRow, setHovRow] = useState<number | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [sortCol, setSortCol] = useState<{ id: string; asc: boolean } | null>(null);

  // 履歴
  const histRef = useRef<Snap[]>([{ columns_def: cols, rows_data: rows }]);
  const histIdxRef = useRef(0);

  function pushHistory(snap: Snap) {
    const h = histRef.current.slice(0, histIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
    histRef.current = h;
    histIdxRef.current = h.length - 1;
  }

  function applySnap(snap: Snap) {
    onUpdate({ ...sheet, columns_def: snap.columns_def, rows_data: snap.rows_data });
  }

  function undo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    applySnap(histRef.current[histIdxRef.current]);
  }

  function redo() {
    if (histIdxRef.current >= histRef.current.length - 1) return;
    histIdxRef.current++;
    applySnap(histRef.current[histIdxRef.current]);
  }

  function commit(next: Snap) {
    pushHistory(next);
    onUpdate({ ...sheet, ...next });
  }

  // ─ セル更新 ─
  function updateCell(ri: number, colId: string, val: string) {
    const nextRows = rows.map((r, i) => i === ri ? { ...r, cells: { ...r.cells, [colId]: val } } : r);
    commit({ columns_def: cols, rows_data: nextRows });
  }

  // ─ 行操作 ─
  function insertRow(at: number) {
    const next = [...rows];
    next.splice(at, 0, { id: uuidv4(), cells: {} });
    commit({ columns_def: cols, rows_data: next });
  }
  function deleteRow(ri: number) {
    commit({ columns_def: cols, rows_data: rows.filter((_, i) => i !== ri) });
    setAnchor(null); setCursor(null);
  }
  function addRow() {
    const next = [...rows, { id: uuidv4(), cells: {} }];
    commit({ columns_def: cols, rows_data: next });
    const ri = next.length - 1;
    setAnchor({ row: ri, col: 0 }); setCursor({ row: ri, col: 0 });
  }

  // ─ 列操作 ─
  function insertCol(at: number) {
    const newCol: SheetColumn = { id: uuidv4(), name: `列 ${cols.length + 1}`, width: DEFAULT_COL_WIDTH };
    const nextCols = [...cols]; nextCols.splice(at, 0, newCol);
    commit({ columns_def: nextCols, rows_data: rows });
  }
  function deleteCol(ci: number) {
    const colId = cols[ci].id;
    commit({
      columns_def: cols.filter((_, i) => i !== ci),
      rows_data: rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }),
    });
    setAnchor(null); setCursor(null);
  }
  function addCol() {
    const newCol: SheetColumn = { id: uuidv4(), name: `列 ${cols.length + 1}`, width: DEFAULT_COL_WIDTH };
    commit({ columns_def: [...cols, newCol], rows_data: rows });
  }
  function renameCol(colId: string, name: string) {
    commit({ columns_def: cols.map(c => c.id === colId ? { ...c, name: name.trim() || c.name } : c), rows_data: rows });
  }
  function updateColWidth(colId: string, width: number) {
    onUpdate({ ...sheet, columns_def: cols.map(c => c.id === colId ? { ...c, width } : c) });
  }

  // ─ ソート ─
  function sortByCol(ci: number) {
    const colId = cols[ci].id;
    const asc = sortCol?.id === colId ? !sortCol.asc : true;
    setSortCol({ id: colId, asc });
    const sorted = [...rows].sort((a, b) => {
      const va = a.cells[colId] ?? '', vb = b.cells[colId] ?? '';
      const num_a = Number(va), num_b = Number(vb);
      const numCompare = !isNaN(num_a) && !isNaN(num_b) ? num_a - num_b : va.localeCompare(vb, 'ja');
      return asc ? numCompare : -numCompare;
    });
    commit({ columns_def: cols, rows_data: sorted });
  }

  // ─ フォーカス移動 ─
  function moveTo(ri: number, ci: number, extendSel = false) {
    const r = Math.max(0, Math.min(rows.length - 1, ri));
    const c = Math.max(0, Math.min(cols.length - 1, ci));
    if (extendSel) {
      setCursor({ row: r, col: c });
    } else {
      setAnchor({ row: r, col: c });
      setCursor({ row: r, col: c });
    }
  }

  // ─ キーボード ─
  function handleCellKeyDown(e: React.KeyboardEvent, ri: number, ci: number) {
    const shift = e.shiftKey;
    if (e.key === 'Tab') { e.preventDefault(); moveTo(ri, shift ? ci - 1 : ci + 1); }
    else if (e.key === 'Enter') { e.preventDefault(); moveTo(shift ? ri - 1 : ri + 1, ci); }
    else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); moveTo(ri - 1, ci, shift); }
    else if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); moveTo(ri + 1, ci, shift); }
    else if (e.key === 'ArrowLeft' && !e.altKey) { e.preventDefault(); moveTo(ri, ci - 1, shift); }
    else if (e.key === 'ArrowRight' && !e.altKey) { e.preventDefault(); moveTo(ri, ci + 1, shift); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (anchor && cursor) {
        const { r0, r1, c0, c1 } = normSel(anchor, cursor);
        if (r0 !== r1 || c0 !== c1) {
          e.preventDefault();
          const nextRows = rows.map((row, rIdx) => {
            if (rIdx < r0 || rIdx > r1) return row;
            const cells = { ...row.cells };
            for (let cc = c0; cc <= c1; cc++) delete cells[cols[cc].id];
            return { ...row, cells };
          });
          commit({ columns_def: cols, rows_data: nextRows });
        }
      }
    }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      setAnchor({ row: 0, col: 0 });
      setCursor({ row: rows.length - 1, col: cols.length - 1 });
    }
  }

  // ─ コピー&ペースト ─
  useEffect(() => {
    async function handleKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'c' && anchor && cursor) {
        e.preventDefault();
        const { r0, r1, c0, c1 } = normSel(anchor, cursor);
        const tsv = rows.slice(r0, r1 + 1).map(row =>
          cols.slice(c0, c1 + 1).map(col => row.cells[col.id] ?? '').join('\t')
        ).join('\n');
        await navigator.clipboard.writeText(tsv);
      }
      if (e.key === 'v' && anchor) {
        e.preventDefault();
        const text = await navigator.clipboard.readText();
        const pasteRows = text.split('\n').map(line => line.split('\t'));
        const startR = anchor.row, startC = anchor.col;
        const nextRows = rows.map((row, ri) => {
          const pr = ri - startR;
          if (pr < 0 || pr >= pasteRows.length) return row;
          const pasteRow = pasteRows[pr];
          const cells = { ...row.cells };
          pasteRow.forEach((val, pi) => {
            const ci = startC + pi;
            if (ci < cols.length) cells[cols[ci].id] = val;
          });
          return { ...row, cells };
        });
        commit({ columns_def: cols, rows_data: nextRows });
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [anchor, cursor, rows, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─ コンテキストメニュー操作 ─
  function handleCtxAction(action: string, ri: number | null, ci: number | null) {
    if (action === 'insertRowAbove' && ri !== null) insertRow(ri);
    if (action === 'insertRowBelow' && ri !== null) insertRow(ri + 1);
    if (action === 'deleteRow' && ri !== null) deleteRow(ri);
    if (action === 'insertColLeft' && ci !== null) insertCol(ci);
    if (action === 'insertColRight' && ci !== null) insertCol(ci + 1);
    if (action === 'deleteCol' && ci !== null) deleteCol(ci);
  }

  // ─ 列リサイズ ─
  const resizingRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  function startResize(e: React.PointerEvent, colId: string, currentW: number) {
    e.preventDefault(); e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startW: currentW };
    function onMove(me: PointerEvent) {
      if (!resizingRef.current) return;
      const newW = Math.max(MIN_COL_WIDTH, resizingRef.current.startW + me.clientX - resizingRef.current.startX);
      updateColWidth(resizingRef.current.colId, newW);
    }
    function onUp() {
      resizingRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // ─ マウスドラッグ選択 ─
  const draggingRef = useRef(false);
  function onCellPointerDown(e: React.PointerEvent, ri: number, ci: number) {
    if (e.button !== 0) return;
    draggingRef.current = true;
    if (e.shiftKey && anchor) {
      setCursor({ row: ri, col: ci });
    } else {
      setAnchor({ row: ri, col: ci });
      setCursor({ row: ri, col: ci });
    }
    function onMove(me: PointerEvent) {
      if (!draggingRef.current) return;
      const el = document.elementFromPoint(me.clientX, me.clientY);
      const cell = el?.closest('[data-cell]') as HTMLElement | null;
      if (cell) {
        const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
        if (!isNaN(r) && !isNaN(c)) setCursor({ row: r, col: c });
      }
    }
    function onUp() {
      draggingRef.current = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  const isActive = (ri: number, ci: number) => anchor?.row === ri && anchor?.col === ci && (!cursor || (cursor.row === ri && cursor.col === ci));
  const isFocused = (ri: number, ci: number) => anchor?.row === ri && anchor?.col === ci;
  const isInSel = (ri: number, ci: number) => inSel(ri, ci, anchor, cursor);
  const isMultiSel = anchor && cursor && (anchor.row !== cursor.row || anchor.col !== cursor.col);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ctx && (
        <ContextMenu ctx={ctx} rows={rows.length} cols={cols.length}
          onClose={() => setCtx(null)} onAction={handleCtxAction} />
      )}
      <div style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 260px)',
        border: `1px solid ${C.border}`, borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', background: C.cell,
      }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: ROW_NUM_W + cols.reduce((s, c) => s + (c.width ?? DEFAULT_COL_WIDTH), 0) + 36 }}>
          <colgroup>
            <col style={{ width: ROW_NUM_W }} />
            {cols.map(c => <col key={c.id} style={{ width: c.width ?? DEFAULT_COL_WIDTH }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, width: ROW_NUM_W, height: HEADER_H, background: C.hBg, borderBottom: `2px solid ${C.hBorder}`, borderRight: `1px solid ${C.border}` }} />
              {cols.map((col, ci) => {
                const colW = col.width ?? DEFAULT_COL_WIDTH;
                const isSortedCol = sortCol?.id === col.id;
                return (
                  <th key={col.id} style={{
                    position: 'sticky', top: 0, zIndex: 2, height: HEADER_H, padding: 0,
                    background: isSortedCol ? '#e0f2fe' : C.hBg,
                    borderBottom: `2px solid ${C.hBorder}`, borderRight: `1px solid ${C.border}`,
                    userSelect: 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', position: 'relative' }}
                      onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, ri: null, ci }); }}
                    >
                      {/* 列名 — 常時編集可能 */}
                      <input
                        value={col.name}
                        onChange={e => renameCol(col.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                        style={{
                          flex: 1, height: '100%', border: 'none', outline: 'none',
                          padding: '0 4px 0 8px', fontSize: '0.75rem', fontWeight: 600,
                          color: C.hText, background: 'transparent', cursor: 'text',
                          minWidth: 0,
                        }}
                        onFocus={e => { e.target.style.background = '#e0f2fe'; e.target.style.color = '#0369a1'; }}
                        onBlur={e => { e.target.style.background = 'transparent'; e.target.style.color = C.hText; }}
                      />
                      {/* ソートボタン */}
                      <button
                        onClick={() => sortByCol(ci)}
                        title="クリックでソート"
                        style={{
                          flexShrink: 0, padding: '0 4px', height: '100%',
                          border: 'none', background: 'none', cursor: 'pointer',
                          fontSize: '0.625rem', color: isSortedCol ? '#0ea5e9' : C.muted,
                          display: 'flex', alignItems: 'center',
                          opacity: isSortedCol ? 1 : 0,
                          transition: 'opacity 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = isSortedCol ? '1' : '0')}
                      >{isSortedCol ? (sortCol.asc ? '↑' : '↓') : '↕'}</button>
                      {/* リサイズハンドル */}
                      <div
                        onPointerDown={e => startResize(e, col.id, colW)}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0ea5e9')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      />
                    </div>
                  </th>
                );
              })}
              {/* 列追加 */}
              <th style={{
                position: 'sticky', top: 0, zIndex: 2, width: 36,
                background: C.hBg, borderBottom: `2px solid ${C.hBorder}`, padding: 0,
              }}>
                <button onClick={addCol} title="列を追加"
                  style={{ width: '100%', height: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = C.addHover; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'none'; }}
                >+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const hov = hovRow === ri;
              return (
                <tr key={row.id}
                  onMouseEnter={() => setHovRow(ri)}
                  onMouseLeave={() => setHovRow(null)}
                  onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, ri, ci: anchor?.col ?? 0 }); }}
                  style={{ background: hov ? '#f0f9ff' : ri % 2 ? C.altRow : C.cell, transition: 'background 0.08s' }}
                >
                  {/* 行番号 */}
                  <td
                    onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, ri, ci: null }); }}
                    style={{
                      width: ROW_NUM_W, height: ROW_H, textAlign: 'center',
                      background: hov ? '#e0f2fe' : C.altRow,
                      borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
                      userSelect: 'none', position: 'relative', transition: 'background 0.08s',
                    }}>
                    {hov ? (
                      <button onClick={() => deleteRow(ri)} title="行を削除"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    ) : <span style={{ fontSize: '0.625rem', color: C.muted }}>{ri + 1}</span>}
                  </td>

                  {/* データセル */}
                  {cols.map((col, ci) => {
                    const sel = isInSel(ri, ci);
                    const foc = isFocused(ri, ci);
                    const act = isActive(ri, ci);
                    return (
                      <td key={col.id}
                        data-cell data-row={ri} data-col={ci}
                        onPointerDown={e => onCellPointerDown(e, ri, ci)}
                        style={{
                          height: ROW_H, padding: 0,
                          borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
                          background: sel ? C.sel : 'transparent',
                          boxShadow: foc ? `inset 0 0 0 2px var(--accent)` : 'none',
                          position: 'relative',
                        }}>
                        <CellInput
                          value={row.cells[col.id] ?? ''}
                          onChange={v => updateCell(ri, col.id, v)}
                          active={act && !isMultiSel}
                          onFocus={() => { setAnchor({ row: ri, col: ci }); setCursor({ row: ri, col: ci }); }}
                          onKeyDown={e => handleCellKeyDown(e, ri, ci)}
                        />
                      </td>
                    );
                  })}
                  <td style={{ borderBottom: `1px solid ${C.border}` }} />
                </tr>
              );
            })}
            {/* 行追加 */}
            <tr>
              <td colSpan={cols.length + 2} style={{ padding: 0 }}>
                <button onClick={addRow}
                  style={{ width: '100%', padding: '7px 0 7px 10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.addHover; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  行を追加
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  const aoa = [sheet.columns_def.map(c => c.name), ...sheet.rows_data.map(row => sheet.columns_def.map(c => row.cells[c.id] ?? ''))];
  const ws = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  writeFile(wb, `${sheet.name}.xlsx`);
}

// ─── タブ本体 ─────────────────────────────────────────────
export default function SheetTab({ projectId }: { projectId: string }) {
  const [sheets, setSheets] = useState<ProjectSheet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabNameVal, setTabNameVal] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`));
    const data = await res.json() as ProjectSheet[];
    setSheets(data);
    if (data.length > 0) setActiveId(id => id ?? data[0].id);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { if (!loaded.current) { loaded.current = true; load(); } }, [load]);

  async function createSheet(name: string, numCols: number, numRows: number) {
    setShowCreateModal(false);
    const cols = makeCols(numCols);
    const rows = makeRows(numRows);
    const res = await fetch(withBasePath(`/api/projects/${projectId}/sheets`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const sheet = await res.json() as ProjectSheet;
    await fetch(withBasePath(`/api/projects/${projectId}/sheets/${sheet.id}`), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns_def: cols, rows_data: rows }),
    });
    const full = { ...sheet, columns_def: cols, rows_data: rows };
    setSheets(prev => [...prev, full]);
    setActiveId(full.id);
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
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch(withBasePath(`/api/projects/${projectId}/sheets/${updated.id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, columns_def: updated.columns_def, rows_data: updated.rows_data }),
      });
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 600);
  }

  async function renameSheet(sheetId: string, name: string) {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) { setEditingTabId(null); return; }
    updateSheet({ ...sheet, name: name.trim() || sheet.name });
    setEditingTabId(null);
  }

  const activeSheet = sheets.find(s => s.id === activeId) ?? null;

  if (loading) return (
    <div className="flex items-center justify-center py-20" style={{ color: C.muted }}>
      <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
      <span className="text-sm">読み込み中...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {showCreateModal && (
        <CreateSheetModal existingCount={sheets.length} onClose={() => setShowCreateModal(false)} onConfirm={createSheet} />
      )}

      {/* ツールバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: '#fafbfc', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* シートタブ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {sheets.map(s => {
            const isAct = activeId === s.id;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', borderRadius: 7, border: `1px solid ${isAct ? 'var(--accent)' : C.border}`, background: isAct ? 'var(--accent-soft)' : '#fff', transition: 'all 0.12s' }}>
                {editingTabId === s.id ? (
                  <input autoFocus value={tabNameVal} onChange={e => setTabNameVal(e.target.value)}
                    onBlur={() => renameSheet(s.id, tabNameVal)}
                    onKeyDown={e => { if (e.key === 'Enter') renameSheet(s.id, tabNameVal); if (e.key === 'Escape') setEditingTabId(null); }}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', border: 'none', outline: 'none', background: 'transparent', width: 120, color: 'var(--accent)' }}
                  />
                ) : (
                  <button onClick={() => setActiveId(s.id)} onDoubleClick={() => { setEditingTabId(s.id); setTabNameVal(s.name); }}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: isAct ? 600 : 400, color: isAct ? 'var(--accent)' : C.hText, border: 'none', background: 'none', cursor: 'pointer' }}
                  >{s.name}</button>
                )}
                {sheets.length > 1 && (
                  <button onClick={() => deleteSheet(s.id)}
                    style={{ padding: '4px 7px 4px 0', fontSize: '0.6875rem', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >✕</button>
                )}
              </div>
            );
          })}
          <button onClick={() => setShowCreateModal(true)}
            style={{ padding: '4px 10px', fontSize: '0.75rem', border: `1px dashed ${C.border}`, borderRadius: 7, background: 'none', cursor: 'pointer', color: C.muted, transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
          >+ シートを追加</button>
        </div>

        {/* 右: 状態 + エクスポート */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: '0.75rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>保存中</span>}
          {saved && !saving && <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>保存済み</span>}
          {activeSheet && (
            <>
              {[
                { label: 'CSV', fn: () => exportCsv(activeSheet), hoverColor: '#0369a1' },
                { label: 'Excel', fn: () => exportXlsx(activeSheet), hoverColor: '#16a34a' },
              ].map(b => (
                <button key={b.label} onClick={b.fn}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: '0.75rem', fontWeight: 500, border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer', color: C.hText, transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = b.hoverColor; e.currentTarget.style.color = b.hoverColor; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.hText; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {b.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* グリッドエリア */}
      <div style={{ padding: 14 }}>
        {sheets.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 64, color: C.muted }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 12px', opacity: 0.3 }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>シートがまだありません</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm">最初のシートを作成</button>
          </div>
        ) : activeSheet ? (
          <SheetGrid key={activeSheet.id} sheet={activeSheet} onUpdate={updateSheet} />
        ) : null}
      </div>

      {/* フッターヒント */}
      {activeSheet && (
        <div style={{ padding: '5px 14px', borderTop: `1px solid ${C.border}`, background: '#fafbfc', display: 'flex', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
          {['右クリックで行/列の挿入・削除', 'ダブルクリックで列名変更', '列ヘッダーでソート', '列境界をドラッグでリサイズ', 'Ctrl+C/V でコピー&ペースト', 'Ctrl+Z/Y でUndo/Redo', 'Shift+クリックで範囲選択'].map(h => (
            <span key={h} style={{ fontSize: '0.625rem', color: C.muted }}>{h}</span>
          ))}
        </div>
      )}
    </div>
  );
}
