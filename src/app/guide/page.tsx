'use client';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { withBasePath } from '@/lib/paths';

// ──────────────────────────────────────────
// サンプル枠（モックアップ全体を囲む）
// ──────────────────────────────────────────
function SampleWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl p-4 md:p-5"
      style={{
        border: '1.5px dashed rgba(100,116,139,0.4)',
        backgroundImage: [
          'repeating-linear-gradient(-45deg, rgba(100,116,139,0.025) 0px, rgba(100,116,139,0.025) 1px, transparent 1px, transparent 7px)',
        ].join(','),
        backgroundColor: 'rgba(148,163,184,0.08)',
      }}>
      {/* フローティングラベル */}
      <span className="absolute -top-3 left-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
        style={{
          background: '#94a3b8',
          color: '#ffffff',
          letterSpacing: '0.1em',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="7" height="7" rx="1" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8"/>
          <line x1="2" y1="3" x2="6" y2="3" stroke="white" strokeWidth="0.9" strokeLinecap="round"/>
          <line x1="2" y1="5" x2="5" y2="5" stroke="white" strokeWidth="0.9" strokeLinecap="round"/>
        </svg>
        サンプル
      </span>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────
// タスクビュー モックアップ（実デザイン準拠）
// ──────────────────────────────────────────
function ListViewMockup() {
  const rows = [
    { title: 'LP構成案を作成する', sc: '#1d6fb8', sb: 'rgba(59,130,246,0.1)', status: '進行中', p: '高', done: false },
    { title: 'バナー素材をデザインする', sc: '#1d6fb8', sb: 'rgba(59,130,246,0.1)', status: '進行中', p: '中', done: false },
    { title: '公開前レビューと最終承認', sc: 'var(--text-muted)', sb: 'rgba(111,135,148,0.1)', status: '未着手', p: '高', done: false },
    { title: 'キャンペーン目標とKPIを設定する', sc: '#1f9d72', sb: 'rgba(31,157,114,0.1)', status: '完了', p: '高', done: true },
    { title: 'ターゲットペルソナを作成する', sc: '#1f9d72', sb: 'rgba(31,157,114,0.1)', status: '完了', p: '中', done: true },
  ];
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg,#fff 0%,rgba(241,250,252,0.9) 100%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>春のキャンペーン — タスク</span>
        </div>
        <div className="flex gap-1">
          {['リスト','カンバン','ガント'].map((v,i) => (
            <span key={v} className={`text-[10px] px-2 py-0.5 rounded-xl font-medium ${i===0?'active':''}`}
              style={i===0 ? { background:'rgba(15,154,177,0.1)', color:'var(--accent)', boxShadow:'inset 0 0 0 1px rgba(15,154,177,0.18)' } : { color:'var(--text-muted)' }}>
              {v}
            </span>
          ))}
        </div>
      </div>
      {rows.map((r,i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 transition-colors hover:bg-[rgba(241,250,252,0.78)]"
          style={{ borderColor: 'var(--border)', opacity: r.done ? 0.55 : 1 }}>
          <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
            style={{ borderColor: r.done ? '#1f9d72' : 'var(--border-strong)', background: r.done ? 'rgba(31,157,114,0.1)' : 'var(--bg-elevated)' }}>
            {r.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#1f9d72" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
          </div>
          <span className="flex-1 truncate text-xs font-medium" style={{ color: r.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: r.sb, color: r.sc }}>{r.status}</span>
          <span className="text-[9px] shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>{r.p}</span>
        </div>
      ))}
    </div>
  );
}

function KanbanViewMockup() {
  const cols = [
    { label:'未着手', c:'var(--text-muted)', bg:'rgba(111,135,148,0.08)', dot:'var(--text-muted)', cards:['LP を実装・テストする','公開前レビュー','公開・施策スタート'] },
    { label:'進行中', c:'#1d6fb8', bg:'rgba(59,130,246,0.08)', dot:'#60a5fa', cards:['LP構成案を作成する','バナー素材をデザインする','コピーライティング依頼'] },
    { label:'完了', c:'#1f9d72', bg:'rgba(31,157,114,0.08)', dot:'#1f9d72', cards:['KPI設定','ペルソナ作成','競合調査'] },
  ];
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg,#fff 0%,rgba(241,250,252,0.9) 100%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>春のキャンペーン — タスク</span>
        </div>
        <div className="flex gap-1">
          {['リスト','カンバン','ガント'].map((v,i) => (
            <span key={v} className="text-[10px] px-2 py-0.5 rounded-xl font-medium"
              style={i===1 ? { background:'rgba(15,154,177,0.1)', color:'var(--accent)', boxShadow:'inset 0 0 0 1px rgba(15,154,177,0.18)' } : { color:'var(--text-muted)' }}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-3 overflow-x-auto" style={{ background: 'rgba(244,251,255,0.6)' }}>
        {cols.map(col => (
          <div key={col.label} className="flex-1 min-w-[110px]">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.dot }} />
              <span className="text-[10px] font-bold" style={{ color: col.c }}>{col.label}</span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: col.bg, color: col.c }}>{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((c,i) => (
                <div key={i} className="rounded-xl border p-2.5 text-[10px] leading-snug cursor-grab transition-shadow hover:shadow-md"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)', boxShadow: '0 1px 3px rgba(44,112,134,0.06)' }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GanttViewMockup() {
  const bars = [
    { label: 'KPI設定',       s: 0,  w: 16, done: true },
    { label: 'ペルソナ作成',  s: 10, w: 18, done: true },
    { label: '競合調査',      s: 18, w: 14, done: true },
    { label: 'LP構成案',      s: 26, w: 20, active: true },
    { label: 'バナー制作',    s: 30, w: 24, active: true },
    { label: 'コピー依頼',    s: 32, w: 22, active: true },
    { label: 'LP実装',        s: 50, w: 18 },
    { label: '公開承認',      s: 66, w: 12 },
    { label: '施策開始',      s: 76, w: 10 },
  ];
  const today = 42;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg,#fff 0%,rgba(241,250,252,0.9) 100%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>春のキャンペーン — タスク</span>
        </div>
        <div className="flex gap-1">
          {['リスト','カンバン','ガント'].map((v,i) => (
            <span key={v} className="text-[10px] px-2 py-0.5 rounded-xl font-medium"
              style={i===2 ? { background:'rgba(15,154,177,0.1)', color:'var(--accent)', boxShadow:'inset 0 0 0 1px rgba(15,154,177,0.18)' } : { color:'var(--text-muted)' }}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="p-3 relative overflow-x-auto">
        <div className="absolute top-3 bottom-5 w-px z-10" style={{ left:`calc(${today}% + 76px)`, background:'rgba(222,91,91,0.5)' }} />
        <div className="space-y-1.5">
          {bars.map((b,i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="text-[9px] text-right shrink-0 w-[68px] truncate font-medium" style={{ color: 'var(--text-muted)' }}>{b.label}</div>
              <div className="flex-1 relative h-5 min-w-[160px]">
                <div className="absolute inset-y-0.5 rounded-full flex items-center justify-center"
                  style={{
                    left:`${b.s}%`, width:`${b.w}%`,
                    background: b.done
                      ? 'linear-gradient(90deg,rgba(31,157,114,0.25),rgba(31,157,114,0.15))'
                      : b.active
                        ? 'linear-gradient(90deg,#0f9ab1,#7ed7de)'
                        : 'rgba(216,231,239,0.7)',
                    border:`1px solid ${b.done ? 'rgba(31,157,114,0.4)' : b.active ? 'rgba(15,154,177,0.5)' : 'var(--border)'}`,
                    boxShadow: b.active ? '0 1px 4px rgba(15,154,177,0.25)' : 'none',
                  }}>
                  {b.done && <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#1f9d72" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex mt-3 pl-[76px]">
          <div className="flex-1 flex justify-between">
            {['5月上旬','5月中旬','5月下旬','6月上旬'].map(l => (
              <span key={l} className="text-[8px]" style={{ color:'var(--text-muted)' }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ビュー切り替えタブ
// ──────────────────────────────────────────
function TaskViewTabs({ isLoggedIn }: { isLoggedIn: boolean | null }) {
  const [active, setActive] = useState<'list'|'kanban'|'gantt'>('list');
  const desc = {
    list: 'ステータスバッジを直接クリックするだけで状態を変更できます。タスク行をクリックして詳細パネルを開くと担当者・期限・優先度を編集できます。',
    kanban: 'カードをつかんで「進行中」「完了」列にドラッグするだけでステータスが更新されます。チームの状況が一目で把握できます。',
    gantt: 'バーの端をドラッグして期限を伸縮できます。未スケジュールのタスクをガント領域にドロップすると日程を設定できます。',
  };
  return (
    <div className="space-y-4">
      <SampleWrapper>
        <div className="flex gap-1.5 mb-4">
          {(['list','kanban','gantt'] as const).map((k,i) => (
            <button key={k} onClick={() => setActive(k)}
              className={`tab-btn${active===k?' active':''}`}>
              {['≡ リスト','⊞ カンバン','▬ ガント'][i]}
            </button>
          ))}
        </div>
        {active==='list'   && <ListViewMockup />}
        {active==='kanban' && <KanbanViewMockup />}
        {active==='gantt'  && <GanttViewMockup />}
        <p className="text-xs mt-3 leading-relaxed" style={{ color:'var(--text-muted)' }}>{desc[active]}</p>
      </SampleWrapper>
      {isLoggedIn === true && (
        <div className="flex gap-2">
          <Link href={withBasePath('/')} className="btn-secondary text-sm">
            ダッシュボードで実際に試す →
          </Link>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// AI生成コンテンツ モックアップ
// ──────────────────────────────────────────
function AiGenerateMockup({ isLoggedIn }: { isLoggedIn: boolean | null }) {
  const [selected, setSelected] = useState<string[]>(['sns_post', 'email']);
  const [addText, setAddText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const templates = [
    { id: 'sns_post', label: 'SNS投稿' },
    { id: 'email',    label: 'メール本文' },
    { id: 'lp',       label: 'LPコピー' },
    { id: 'ad_copy',  label: '広告コピー' },
    { id: 'report',   label: 'ステータスレポート' },
  ];

  const contextFields = [
    { label: '目的・背景',     value: '新規顧客への認知を拡大し、トライアル申込みを促進する。' },
    { label: 'ターゲット',     value: '25〜40代・中小企業のマーケター・事業責任者。' },
    { label: '訴求メッセージ', value: 'チームの施策管理を、もっとシンプルに。' },
    { label: 'CTA',           value: '14日間無料で試す' },
  ];

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    setShowResult(false);
  }

  function generate() {
    setGenerating(true);
    setShowResult(false);
    setTimeout(() => { setGenerating(false); setShowResult(true); }, 1400);
  }

  return (
    <section className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase mb-2" style={{ color: 'var(--accent)' }}>
          <span>✦</span> AI生成コンテンツ
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          プロジェクト情報をもとにコンテンツをワンクリックで生成
        </h2>
        <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
          プロジェクトに入力した情報（目的・ターゲット・訴求メッセージなど）をAIが読み取り、SNS投稿・メール・LPコピーなどを一括生成します。
          追加の指示やノートを補足情報として渡すことで、より精度の高い文章が得られます。
          生成されたコンテンツはプロジェクト内の「生成コンテンツ」タブに保存されます。
        </p>
      </div>

      <SampleWrapper>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_28px_260px] gap-4 items-start">
          {/* コンテキスト情報 */}
          <div>
            <p className="section-title mb-2">プロジェクト情報（AIへの参照データ）</p>
            <div className="space-y-2">
              {contextFields.map(f => (
                <div key={f.label} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  <span className="block text-[10px] font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{f.value}</span>
                </div>
              ))}
              <div className="rounded-xl border px-3 py-2 flex items-center gap-1.5"
                style={{ borderColor: 'rgba(15,154,177,0.3)', background: 'rgba(15,154,177,0.04)' }}>
                <span className="text-xs" style={{ color: 'var(--accent)' }}>📎</span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>参照ノート: ブランドガイドライン.md</span>
              </div>
            </div>
          </div>

          {/* 矢印 */}
          <div className="hidden md:flex items-center justify-center pt-10">
            <span className="text-xl" style={{ color: 'rgba(15,154,177,0.35)' }}>→</span>
          </div>

          {/* AI生成パネル */}
          <div>
            <p className="section-title mb-2">AI生成パネル（サイドバー）</p>
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b flex gap-1"
                style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg,#fff 0%,rgba(241,250,252,0.9) 100%)' }}>
                {['サポート', 'サマリー'].map((t, i) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-xl font-medium"
                    style={i === 0
                      ? { background: 'rgba(15,154,177,0.1)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.18)' }
                      : { color: 'var(--text-muted)' }}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>AI生成</p>
                <div className="space-y-1">
                  {templates.map(t => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded transition-colors hover:bg-[rgba(15,154,177,0.04)]">
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)}
                        style={{ accentColor: 'var(--accent)' }} className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>追加指示（任意）</p>
                  <textarea
                    value={addText}
                    onChange={e => setAddText(e.target.value)}
                    placeholder="例：カジュアルなトーンで、絵文字を多めに..."
                    className="w-full text-[10px] rounded-lg border resize-none p-2 leading-relaxed"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', height: '48px', outline: 'none' }}
                  />
                </div>
                <button
                  onClick={generate}
                  disabled={selected.length === 0 || generating}
                  className="btn-primary w-full text-xs py-2"
                  style={{ opacity: selected.length === 0 ? 0.5 : 1 }}>
                  {generating ? '⏳ 生成中...' : `選択中の ${selected.length} 件を生成`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 生成結果 */}
        {showResult && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>生成結果</span>
              {selected.map((s, i) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={i === 0
                    ? { background: 'rgba(31,157,114,0.1)', color: 'var(--success)' }
                    : { background: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                  {templates.find(t => t.id === s)?.label}
                </span>
              ))}
            </div>
            <div className="card p-4 space-y-3">
              <pre className="text-xs leading-relaxed whitespace-pre-line font-sans" style={{ color: 'var(--text-primary)' }}>{`【春の新生活キャンペーン開幕🌸】

チームの施策管理、もっとシンプルにできます。

✅ プロジェクト・タスク・ノートをひとつの場所に
✅ リスト/カンバン/ガントを瞬時に切り替え
✅ AIがコンテンツ生成までサポート

まずは14日間、無料でお試しください。
👉 [申し込みリンク]

#プロジェクト管理 #マーケティング #施策管理`}</pre>
              <div className="pt-2 border-t flex items-start gap-1.5" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>⚠️</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  整合性チェック: 目的・背景、訴求メッセージ、CTAを参照しました
                </span>
              </div>
            </div>
          </div>
        )}
      </SampleWrapper>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {isLoggedIn === true ? (
          <>
            <Link href={withBasePath('/settings/ai')} className="btn-primary text-sm">
              AI設定を開く →
            </Link>
            <Link href={withBasePath('/settings/content-templates')} className="btn-secondary text-sm">
              生成テンプレートを管理する →
            </Link>
          </>
        ) : (
          <Link href={withBasePath('/signup')} className="btn-primary text-sm">
            無料で始める →
          </Link>
        )}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          AIプロバイダー（Claude / OpenAI / Gemini）の設定は管理者が行います
        </span>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
// 管理者向けカスタマイズ モックアップ
// ──────────────────────────────────────────
function AdminCustomizeMockup({ isLoggedIn }: { isLoggedIn: boolean | null }) {
  const [tab, setTab] = useState<'types'|'fields'|'reflect'>('types');
  const [expandedId, setExpandedId] = useState<string|null>('campaign');
  const [typeList, setTypeList] = useState([
    { id:'campaign', name:'キャンペーン', key:'campaign', isDefault:true, phases:['企画','制作','実施','振り返り'], fieldCount:8 },
    { id:'event',    name:'イベント',     key:'event',    isDefault:false, phases:['準備','当日','事後対応'],     fieldCount:6 },
    { id:'other',    name:'その他',       key:'other',    isDefault:false, phases:['進行中','完了'],              fieldCount:4 },
  ]);
  const [showPicker, setShowPicker] = useState(false);
  const [fieldList, setFieldList] = useState([
    { id:'purpose', label:'目的・背景',   type:'テキストエリア', isNew:false },
    { id:'target',  label:'ターゲット',   type:'テキストエリア', isNew:false },
    { id:'kpi',     label:'KPI・成果指標', type:'テキストエリア', isNew:false },
  ]);

  const fieldTypes = [
    { icon:'T',  label:'テキスト',     type:'テキスト'     },
    { icon:'≡',  label:'テキストエリア', type:'テキストエリア' },
    { icon:'▾',  label:'選択肢',       type:'選択肢'       },
    { icon:'📅', label:'日付',         type:'日付'         },
    { icon:'#',  label:'数値',         type:'数値'         },
    { icon:'🔗', label:'URL',          type:'URL'          },
  ];

  const reflectFields = [
    { id:'purpose', label:'目的・背景',   type:'テキストエリア', isNew:false },
    { id:'target',  label:'ターゲット',   type:'テキストエリア', isNew:false },
    { id:'kpi',     label:'KPI・成果指標', type:'テキストエリア', isNew:false },
    { id:'new',     label:'新しい項目',   type:'選択肢',        isNew:true  },
  ];

  function addType() {
    const id = `custom-${Date.now()}`;
    setTypeList(p => [...p, { id, name:'新しい種別', key:`type_${p.length+1}`, isDefault:false, phases:['フェーズ1'], fieldCount:0 }]);
    setExpandedId(id);
  }

  function pickField(type: string) {
    setFieldList(p => [...p.map(f=>({...f,isNew:false})), { id:`f-${Date.now()}`, label:'新しい項目', type, isNew:true }]);
    setShowPicker(false);
  }

  const tabs = [
    { k:'types'  as const, l:'種別管理' },
    { k:'fields' as const, l:'項目の追加' },
    { k:'reflect'as const, l:'プロジェクトへ反映' },
  ];

  return (
    <section className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase mb-2" style={{ color:'var(--accent)' }}>
          <span>⚙</span> 管理者向け: プロジェクトをカスタマイズする
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold" style={{ color:'var(--text-primary)' }}>
            種別・項目テンプレートを自由に定義できます
          </h2>
        </div>
        <p className="text-sm mt-2 leading-7" style={{ color:'var(--text-secondary)' }}>
          プロジェクト種別ごとにフェーズと入力項目を定義します。定義した項目がそのままプロジェクト詳細の入力フォームになります。
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`tab-btn${tab===t.k?' active':''}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ──── タブ1: 種別管理 ──── */}
      {tab === 'types' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color:'var(--text-muted)' }}>
            種別カードを展開するとフェーズ定義と項目テンプレートを確認できます。「+ 種別を追加」で新しい種別を作成できます。
          </p>
          <SampleWrapper>
          <div className="space-y-3">
            {typeList.map(type => (
              <div key={type.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId===type.id ? null : type.id)}
                  className="row-hover w-full px-5 py-4 flex items-center justify-between gap-4 text-left border-b"
                  style={{ borderColor: expandedId===type.id ? 'var(--border)' : 'transparent' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{type.name}</span>
                      {type.isDefault && (
                        <span className="text-[0.6875rem] px-2 py-0.5 rounded-full" style={{ backgroundColor:'rgba(56,189,248,0.14)', color:'rgb(125,211,252)' }}>
                          default
                        </span>
                      )}
                                </div>
                    <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
                      key: {type.key} ・ フェーズ {type.phases.length}件 ・ 項目 {type.fieldCount}件
                    </p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color:'var(--text-secondary)' }}>
                    {expandedId===type.id ? '▲ 閉じる' : '▼ 開く'}
                  </span>
                </button>

                {expandedId===type.id && (
                  <div className="p-5 space-y-4">
                    {/* フェーズ */}
                    <div>
                      <p className="section-title mb-2">フェーズ設定</p>
                      <div className="flex flex-wrap gap-2">
                        {type.phases.map((ph, pi) => (
                          <div key={pi} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium"
                            style={{ borderColor:'var(--border)', background:'rgba(255,255,255,0.68)', color:'var(--text-secondary)' }}>
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background: pi===0 ? 'var(--accent)' : 'var(--border-strong)' }}>{pi+1}</span>
                            {ph}
                          </div>
                        ))}
                        <button className="btn-secondary text-xs py-1 px-3">+ フェーズ追加</button>
                      </div>
                    </div>
                    {/* 項目テンプレート抜粋 */}
                    <div>
                      <p className="section-title mb-2">項目テンプレート（抜粋）</p>
                      <div className="space-y-2">
                        {['目的・背景','ターゲット','KPI・成果指標'].map(item => (
                          <div key={item} className="rounded-md border p-3 flex items-center gap-2"
                            style={{ borderColor:'var(--border)', background:'rgba(255,255,255,0.68)' }}>
                            <span className="text-sm cursor-grab select-none" style={{ color:'var(--text-muted)' }}>⋮⋮</span>
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-semibold mb-0.5" style={{ color:'var(--text-secondary)' }}>項目名</span>
                              <span className="text-xs" style={{ color:'var(--text-primary)' }}>{item}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium shrink-0"
                              style={{ background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid rgba(15,154,177,0.2)' }}>
                              テキストエリア
                            </span>
                            <button className="btn-danger text-xs py-0.5 px-2">削除</button>
                          </div>
                        ))}
                      </div>
                      <button className="btn-secondary text-xs py-1 px-3 mt-2">+ 項目を追加</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addType}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border:'2px dashed var(--border)', color:'var(--accent)', background:'rgba(15,154,177,0.02)' }}>
              + 種別を追加
            </button>
            <button className="btn-primary text-sm">保存</button>
          </div>
          </SampleWrapper>
          {isLoggedIn===true && (
            <div className="flex items-center gap-3 pt-1">
              <Link href={withBasePath('/project-types')} className="btn-primary text-sm">
                プロジェクト種別設定を開く →
              </Link>
              <span className="text-xs" style={{ color:'var(--text-muted)' }}>実際の設定画面で種別の追加・編集ができます</span>
            </div>
          )}
        </div>
      )}

      {/* ──── タブ2: 項目の追加 ──── */}
      {tab === 'fields' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color:'var(--text-muted)' }}>
            「+ 項目を追加」を押して型を選ぶと、項目がテンプレートに追加されます。⋮⋮ ハンドルをドラッグして並び替えや別セクションへの移動もできます。
          </p>
          <SampleWrapper>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor:'var(--border)', background:'linear-gradient(180deg,#fff 0%,rgba(241,250,252,0.9) 100%)' }}>
              <div className="flex items-center gap-2">
                <p className="section-title">基本情報</p>
                    </div>
            </div>
            <div className="p-3 space-y-2">
              {fieldList.map(f => (
                <div key={f.id} className="rounded-md border p-3 flex items-center gap-2 transition-all"
                  style={{
                    borderColor: f.isNew ? 'rgba(15,154,177,0.4)' : 'var(--border)',
                    background: f.isNew ? 'rgba(15,154,177,0.04)' : 'rgba(255,255,255,0.68)',
                    borderLeft: f.isNew ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>
                  <span className="text-sm cursor-grab select-none shrink-0" style={{ color:'var(--text-muted)' }}>⋮⋮</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: f.isNew ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {f.label}
                      </span>
                      {f.isNew && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'var(--accent)', color:'white' }}>NEW</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium shrink-0"
                    style={{ background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid rgba(15,154,177,0.2)' }}>
                    {f.type}
                  </span>
                  <button onClick={() => setFieldList(p => p.filter(x => x.id !== f.id))}
                    className="btn-danger text-xs py-0.5 px-2 shrink-0">削除</button>
                </div>
              ))}
            </div>
          </div>

          {/* 型ピッカー */}
          <div className="relative">
            <button onClick={() => setShowPicker(v=>!v)}
              className={showPicker ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
              + 項目を追加
            </button>
            {showPicker && (
              <div className="mt-2 card p-4">
                <p className="section-title mb-3">フィールドの型を選択</p>
                <div className="grid grid-cols-3 gap-2">
                  {fieldTypes.map(ft => (
                    <button key={ft.type} onClick={() => pickField(ft.type)}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all hover:shadow-md"
                      style={{ borderColor:'var(--border)', background:'var(--bg-elevated)', color:'var(--text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(15,154,177,0.4)'; (e.currentTarget as HTMLButtonElement).style.background='var(--accent-soft)'; (e.currentTarget as HTMLButtonElement).style.color='var(--accent)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLButtonElement).style.background='var(--bg-elevated)'; (e.currentTarget as HTMLButtonElement).style.color='var(--text-secondary)'; }}>
                      <span className="text-base leading-none">{ft.icon}</span>
                      <span className="text-[10px] font-medium">{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </SampleWrapper>
          {isLoggedIn===true && (
            <div className="flex items-center gap-3 pt-1">
              <Link href={withBasePath('/project-types')} className="btn-primary text-sm">
                プロジェクト種別設定を開く →
              </Link>
              <span className="text-xs" style={{ color:'var(--text-muted)' }}>実際の設定画面で項目の追加・削除・並び替えができます</span>
            </div>
          )}
        </div>
      )}

      {/* ──── タブ3: プロジェクトへ反映 ──── */}
      {tab === 'reflect' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color:'var(--text-muted)' }}>
            種別設定で定義した項目テンプレートが、プロジェクト詳細の「項目」タブにそのまま入力フォームとして表示されます。
          </p>
          <SampleWrapper>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_40px_1fr] gap-3 items-start">
            {/* 左: 設定側 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="section-title">設定 › プロジェクト種別設定</p>
                    </div>
              <div className="card overflow-hidden">
                <div className="px-4 py-2.5 border-b" style={{ borderColor:'var(--border)', background:'rgba(244,251,255,0.8)' }}>
                  <span className="section-title">基本情報</span>
                </div>
                <div className="p-2 space-y-1.5">
                  {reflectFields.map((f, i) => (
                    <div key={f.id} className="rounded-md border p-2 flex items-center gap-2"
                      style={{
                        borderColor: f.isNew ? 'rgba(15,154,177,0.4)' : 'var(--border)',
                        background: f.isNew ? 'rgba(15,154,177,0.04)' : 'rgba(255,255,255,0.68)',
                        borderLeft: f.isNew ? '3px solid var(--accent)' : '3px solid transparent',
                      }}>
                      <span className="text-xs shrink-0" style={{ color:'var(--text-muted)' }}>⋮⋮</span>
                      <span className="flex-1 text-[10px] font-semibold" style={{ color: f.isNew ? 'var(--accent)' : 'var(--text-secondary)' }}>{f.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background:'var(--accent-soft)', color:'var(--accent)' }}>{f.type}</span>
                      {f.isNew && <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background:'var(--accent)', color:'white' }}>NEW</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 中央: 矢印 */}
            <div className="flex items-center justify-center sm:mt-12">
              <span className="text-xl font-light" style={{ color:'var(--accent)' }}>→</span>
            </div>

            {/* 右: プロジェクト詳細 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="section-title">プロジェクト詳細 › 項目タブ</p>
                    </div>
              <div className="card overflow-hidden">
                <div className="px-4 py-2.5 border-b" style={{ borderColor:'var(--border)', background:'rgba(244,251,255,0.8)' }}>
                  <span className="section-title">基本情報</span>
                </div>
                <div className="p-3 space-y-3">
                  {reflectFields.map(f => (
                    <div key={f.id}>
                      <label className="field-label">{f.label}</label>
                      {f.type==='テキストエリア' ? (
                        <div className="field-input text-[10px] h-8 flex items-center" style={{ color:'var(--text-muted)' }}>
                          テキストを入力…
                        </div>
                      ) : (
                        <div className="field-input text-[10px] flex items-center justify-between"
                          style={{ borderColor: f.isNew ? 'rgba(15,154,177,0.4)' : 'var(--border)', background: f.isNew ? 'var(--accent-soft)' : 'var(--bg-elevated)', color:'var(--text-muted)' }}>
                          <span>選択してください</span>
                          <span style={{ color:'var(--text-muted)' }}>▾</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-center py-1" style={{ color:'var(--text-muted)' }}>
            種別設定の変更は、その種別で作成されたすべてのプロジェクトの「項目」タブに即座に反映されます
          </p>
          </SampleWrapper>
          {isLoggedIn===true && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href={withBasePath('/project-types')} className="btn-primary text-sm">
                プロジェクト種別設定を開く →
              </Link>
              <Link href={withBasePath('/')} className="btn-secondary text-sm">
                ダッシュボードへ
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ──────────────────────────────────────────
// 機能カード
// ──────────────────────────────────────────
function FeatureCard({ icon, title, desc, tags }: { icon:string; title:string; desc:string; tags:string[] }) {
  return (
    <div className="card p-5 hover:shadow-lg transition-shadow">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-sm font-bold mb-1.5" style={{ color:'var(--text-primary)' }}>{title}</h3>
      <p className="text-xs leading-relaxed mb-3" style={{ color:'var(--text-secondary)' }}>{desc}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid rgba(15,154,177,0.2)' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────
export default function GuidePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean|null>(null);
  const viewRef  = useRef<HTMLDivElement>(null);
  const aiRef    = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(withBasePath('/api/auth/me'), { cache:'no-store' })
      .then(r => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-16">

      {/* ──── ヒーロー ──── */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
          style={{ background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid rgba(15,154,177,0.2)' }}>
          <span>⬡</span> 使い方ガイド
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color:'var(--text-primary)' }}>
          プロジェクトとタスクを<br className="sm:hidden" />ひとつの場所で
        </h1>
        <p className="text-base leading-8 max-w-xl mx-auto mb-8" style={{ color:'var(--text-secondary)' }}>
          Struct は、プロジェクト単位で情報・タスク・ノートをまとめて管理するツールです。
          チームで進捗を共有しながら、施策を確実に実行できます。
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {isLoggedIn===true ? (
            <Link href={withBasePath('/')} className="btn-primary px-6 py-2.5">ダッシュボードへ →</Link>
          ) : (
            <>
              <Link href={withBasePath('/signup')} className="btn-primary px-6 py-2.5">無料で始める</Link>
              <Link href={withBasePath('/login')} className="btn-secondary px-6 py-2.5">ログイン</Link>
            </>
          )}
          <button onClick={() => viewRef.current?.scrollIntoView({ behavior:'smooth' })}
            className="btn-secondary px-6 py-2.5">タスク管理を見る ↓</button>
          <button onClick={() => aiRef.current?.scrollIntoView({ behavior:'smooth' })}
            className="btn-secondary px-6 py-2.5">AI生成を見る ↓</button>
          <button onClick={() => adminRef.current?.scrollIntoView({ behavior:'smooth' })}
            className="btn-secondary px-6 py-2.5">管理者向け機能を見る ↓</button>
        </div>
      </section>

      {/* ──── タスク管理（3ビュー） ──── */}
      <section ref={viewRef}>
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase mb-2" style={{ color:'var(--accent)' }}>
            <span>✓</span> タスク管理
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color:'var(--text-primary)' }}>
            3つのビューで進捗を把握
          </h2>
          <p className="text-sm leading-7" style={{ color:'var(--text-secondary)' }}>
            リスト・カンバン・ガントをワンクリックで切り替え。タブを選んでそれぞれのビューを確認してみてください。
          </p>
        </div>
        <TaskViewTabs isLoggedIn={isLoggedIn} />
      </section>

      {/* ──── AI生成コンテンツ ──── */}
      <div ref={aiRef}>
        <AiGenerateMockup isLoggedIn={isLoggedIn} />
      </div>

      {/* ──── 機能カード ──── */}
      <section>
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase mb-2" style={{ color:'var(--accent)' }}>
            <span>⬡</span> 主な機能
          </div>
          <h2 className="text-2xl font-bold" style={{ color:'var(--text-primary)' }}>
            プロジェクト運用に必要なものが揃っています
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FeatureCard icon="📋" title="プロジェクト管理"
            desc="案件ごとにプロジェクトを作成し、概要・目標・ターゲット・予算などの情報を一元管理。フェーズ管理で進行状況を可視化します。"
            tags={['フェーズ管理','カスタム項目','ステータス管理']} />
          <FeatureCard icon="✓" title="タスク管理"
            desc="タスクの担当者・期限・優先度を設定して追跡。リスト・カンバン・ガントの3ビューで状況に応じた見方ができます。"
            tags={['リスト','カンバン','ガント','サブタスク']} />
          <FeatureCard icon="📝" title="プロジェクトノート"
            desc="打ち合わせ議事録・調査メモ・決定事項をプロジェクト内に保存。Markdownで書け、ピン留めで重要ノートを先頭に固定できます。"
            tags={['Markdown','ピン留め','全文検索']} />
          <FeatureCard icon="🗂" title="シート（表形式データ）"
            desc="チェックリスト・スケジュール表・費用管理など、タスクでは管理しにくい表形式データをプロジェクト内に保存できます。"
            tags={['カスタム列','ドロップダウン','行の追加']} />
          <FeatureCard icon="👥" title="チーム・メンバー管理"
            desc="プロジェクトごとにメンバーを招待し、役割（マネージャー/メンバー/ゲスト）を設定。閲覧・編集権限をコントロールできます。"
            tags={['招待','ロール管理','権限制御']} />
          <FeatureCard icon="✦" title="AIコンテンツ生成"
            desc="プロジェクトの目的・ターゲット・訴求メッセージをもとにAIがSNS投稿・メール・LPコピーなどを一括生成。追加指示やノートで精度を調整できます。"
            tags={['SNS投稿','メール','LPコピー','広告コピー','レポート']} />
        </div>
      </section>

      {/* ──── 始め方ステップ ──── */}
      <section className="card p-7" style={{ background:'linear-gradient(135deg,rgba(15,154,177,0.04) 0%,rgba(241,250,252,0.6) 100%)' }}>
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase mb-2" style={{ color:'var(--accent)' }}>
            <span>→</span> 始め方
          </div>
          <h2 className="text-xl font-bold" style={{ color:'var(--text-primary)' }}>3ステップで使い始めよう</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n:'1', title:'練習プロジェクトを開く', desc:'ダッシュボードの「練習を始める」バナーからアクセス。リスト・カンバン・ガントを実際に操作してみましょう。', icon:'▶' },
            { n:'2', title:'タスクを完了にする',     desc:'各練習タスクの説明を読みながら操作し、終わったらタスクを「完了」に変更します。8ステップで基本操作が完了します。', icon:'✓' },
            { n:'3', title:'本番プロジェクトを作成する', desc:'練習が終わったら、実際の業務プロジェクトを作成してチームを招待しましょう。', icon:'⬡' },
          ].map(s => (
            <div key={s.n} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                  style={{ background:'linear-gradient(135deg,#0f9ab1,#0e8fa3)' }}>{s.n}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color:'var(--text-primary)' }}>{s.title}</p>
                <p className="text-xs leading-relaxed" style={{ color:'var(--text-secondary)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-7 pt-6 border-t flex flex-wrap gap-3 items-center" style={{ borderColor:'rgba(15,154,177,0.15)' }}>
          {isLoggedIn===true ? (
            <>
              <Link href={withBasePath('/')} className="btn-primary">ダッシュボードへ →</Link>
              <p className="text-xs" style={{ color:'var(--text-muted)' }}>ダッシュボードの「はじめましょう」バナーから練習プロジェクトを開けます</p>
            </>
          ) : (
            <>
              <Link href={withBasePath('/signup')} className="btn-primary">無料で始める →</Link>
              <Link href={withBasePath('/login')} className="btn-secondary">ログイン</Link>
            </>
          )}
        </div>
      </section>

      {/* ──── 管理者向けカスタマイズ ──── */}
      <div ref={adminRef}>
        <AdminCustomizeMockup isLoggedIn={isLoggedIn} />
      </div>

    </div>
  );
}
