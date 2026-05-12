'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';

const STORAGE_KEY = 'struct_welcome_v1_seen';

// ──────────────────────────────────────────
// ミニモックアップ: リストビュー
// ──────────────────────────────────────────
function ListMockup() {
  const rows = [
    { title: 'LP構成案を作成する', status: '進行中', statusColor: '#3b82f6', statusBg: '#eff6ff', priority: '高', done: false },
    { title: 'バナー素材をデザインする', status: '進行中', statusColor: '#3b82f6', statusBg: '#eff6ff', priority: '中', done: false },
    { title: '公開前レビューと最終承認', status: '未着手', statusColor: '#6b7280', statusBg: '#f3f4f6', priority: '高', done: false },
    { title: 'キャンペーン目標とKPIを設定する', status: '完了', statusColor: '#10b981', statusBg: '#ecfdf5', priority: '高', done: true },
  ];
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0', background: '#fff', fontSize: 11 }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <span style={{ color: '#0f9ab1', fontWeight: 700, fontSize: 10 }}>リスト</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>カンバン</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>ガント</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 border-b last:border-0" style={{ borderColor: '#f1f5f9', opacity: r.done ? 0.55 : 1 }}>
          <div className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
            style={{ borderColor: r.done ? '#10b981' : '#cbd5e1', background: r.done ? '#ecfdf5' : 'white' }}>
            {r.done && <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#10b981" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
          </div>
          <span className="flex-1 truncate" style={{ color: r.done ? '#94a3b8' : '#1e293b', textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</span>
          <span className="px-1.5 py-0.5 rounded-full shrink-0" style={{ background: r.statusBg, color: r.statusColor, fontWeight: 600, fontSize: 9 }}>{r.status}</span>
          <span className="shrink-0" style={{ color: '#94a3b8', fontSize: 9 }}>{r.priority}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// ミニモックアップ: カンバンビュー
// ──────────────────────────────────────────
function KanbanMockup() {
  const columns = [
    { label: '未着手', color: '#6b7280', bg: '#f3f4f6', cards: ['LP を実装・テストする', '公開前レビューと最終承認', '公開・施策スタート'] },
    { label: '進行中', color: '#3b82f6', bg: '#eff6ff', cards: ['LP構成案を作成する', 'バナー素材をデザインする'] },
    { label: '完了', color: '#10b981', bg: '#ecfdf5', cards: ['キャンペーン目標を設定', 'ターゲットペルソナ作成', '競合調査をまとめる'] },
  ];
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0', background: '#f8fafc', fontSize: 10 }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>リスト</span>
        <span style={{ color: '#0f9ab1', fontWeight: 700, fontSize: 10 }}>カンバン</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>ガント</span>
      </div>
      <div className="flex gap-2 p-2">
        {columns.map(col => (
          <div key={col.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
              <span style={{ color: col.color, fontWeight: 700, fontSize: 9 }}>{col.label}</span>
              <span className="ml-auto px-1 rounded-full" style={{ background: col.bg, color: col.color, fontSize: 8, fontWeight: 600 }}>{col.cards.length}</span>
            </div>
            <div className="space-y-1">
              {col.cards.map((c, i) => (
                <div key={i} className="rounded-lg px-2 py-1.5 shadow-sm border" style={{ background: 'white', borderColor: '#e2e8f0', fontSize: 9, color: '#334155', lineHeight: 1.4 }}>
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

// ──────────────────────────────────────────
// ミニモックアップ: ガントビュー
// ──────────────────────────────────────────
function GanttMockup() {
  const bars = [
    { label: 'KPI設定', start: 0, width: 18, done: true },
    { label: 'ペルソナ作成', start: 10, width: 20, done: true },
    { label: 'LP構成案', start: 22, width: 22, done: false, active: true },
    { label: 'バナー制作', start: 28, width: 26, done: false, active: true },
    { label: 'LP実装', start: 48, width: 20, done: false },
    { label: '公開・施策開始', start: 66, width: 16, done: false },
  ];
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0', background: '#fff', fontSize: 10 }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>リスト</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>カンバン</span>
        <span style={{ color: '#0f9ab1', fontWeight: 700, fontSize: 10 }}>ガント</span>
      </div>
      <div className="p-2 space-y-1.5">
        {bars.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-16 shrink-0 truncate text-right" style={{ color: '#64748b', fontSize: 8 }}>{b.label}</div>
            <div className="flex-1 relative h-4">
              <div className="absolute inset-y-0 rounded-full flex items-center px-1.5"
                style={{
                  left: `${b.start}%`,
                  width: `${b.width}%`,
                  background: b.done ? '#d1fae5' : b.active ? 'linear-gradient(90deg,#0f9ab1,#7ed7de)' : '#e2e8f0',
                  border: `1px solid ${b.done ? '#6ee7b7' : b.active ? 'rgba(15,154,177,0.4)' : '#cbd5e1'}`,
                }}>
                {b.done && <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#059669" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// スライド定義
// ──────────────────────────────────────────
const slides = [
  {
    id: 'welcome',
    badge: 'ようこそ',
    title: 'Struct へようこそ',
    description: 'プロジェクトとタスクをひとつの場所で管理できます。まず練習プロジェクトで基本操作を体験してみましょう。',
    visual: (
      <div className="flex flex-col items-center justify-center py-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0f9ab1 0%, #7ed7de 100%)' }}>
          ⬡
        </div>
        <div className="flex gap-3 mt-2">
          {['プロジェクト管理', 'タスク管理', 'チーム共有'].map(t => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'rgba(15,154,177,0.1)', color: '#0f9ab1', border: '1px solid rgba(15,154,177,0.2)' }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'task-views',
    badge: 'タスク管理',
    title: '3つのビューでタスクを管理',
    description: 'リスト・カンバン・ガントを自由に切り替えて、状況に合った見方でタスクを管理できます。',
    visual: (
      <div className="space-y-2 py-2">
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { icon: '≡', label: 'リスト', desc: '一覧で確認' },
            { icon: '⊞', label: 'カンバン', desc: '列で整理' },
            { icon: '▬', label: 'ガント', desc: '期間で把握' },
          ].map(v => (
            <div key={v.label} className="rounded-lg p-2 text-center border"
              style={{ background: 'rgba(15,154,177,0.06)', borderColor: 'rgba(15,154,177,0.2)' }}>
              <div className="text-lg mb-0.5">{v.icon}</div>
              <div className="text-xs font-semibold" style={{ color: '#0f9ab1' }}>{v.label}</div>
              <div className="text-[9px] mt-0.5" style={{ color: '#64748b' }}>{v.desc}</div>
            </div>
          ))}
        </div>
        <ListMockup />
      </div>
    ),
  },
  {
    id: 'kanban',
    badge: 'カンバン',
    title: 'ドラッグ&ドロップで進捗を更新',
    description: 'カードをつかんで「進行中」「完了」列に移動するだけでステータスが更新されます。チーム全体の進捗が一目で把握できます。',
    visual: (
      <div className="py-2">
        <KanbanMockup />
        <p className="text-xs text-center mt-3" style={{ color: '#94a3b8' }}>
          カードをドラッグして列間を移動できます
        </p>
      </div>
    ),
  },
  {
    id: 'gantt',
    badge: 'ガント',
    title: '期間とスケジュールを可視化',
    description: 'ガントビューでタスクの期間・重なり・全体スケジュールを把握。バーのドラッグで期限を調整できます。',
    visual: (
      <div className="py-2">
        <GanttMockup />
        <p className="text-xs text-center mt-3" style={{ color: '#94a3b8' }}>
          バーの端をドラッグして期間を調整できます
        </p>
      </div>
    ),
  },
  {
    id: 'start',
    badge: '準備完了',
    title: '練習プロジェクトで体験しよう',
    description: 'ダッシュボードに練習プロジェクトが用意されています。タスクを上から順にこなすと基本操作が一通り学べます。',
    visual: (
      <div className="space-y-2.5 py-3">
        {[
          { n: '1', t: '練習プロジェクトを開く', d: 'ダッシュボードの「練習を始める」ボタン' },
          { n: '2', t: 'タスクタブを開く', d: 'リスト→カンバン→ガントを切り替えて体験' },
          { n: '3', t: 'タスクを完了にする', d: '操作したらタスクを「完了」に変更' },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-3 p-3 rounded-xl border"
            style={{ borderColor: 'rgba(15,154,177,0.2)', background: 'rgba(15,154,177,0.04)' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: '#0f9ab1', color: 'white' }}>{s.n}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>{s.t}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.d}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  function dismiss() {
    setClosing(true);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 250);
  }

  function goNext() {
    if (step < slides.length - 1) setStep(s => s + 1);
  }

  function goPrev() {
    if (step > 0) setStep(s => s - 1);
  }

  function handleStart() {
    dismiss();
    router.push(withBasePath('/'));
  }

  if (!visible) return null;

  const slide = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.25s ease',
      }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '90vh',
          transform: closing ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#f1f5f9' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(15,154,177,0.1)', color: '#0f9ab1' }}>
              {slide.badge}
            </span>
            <button onClick={dismiss} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <h2 className="text-xl font-bold" style={{ color: '#0f172a' }}>{slide.title}</h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#475569' }}>{slide.description}</p>
        </div>

        {/* ビジュアル */}
        <div className="px-6 overflow-y-auto" style={{ maxHeight: 320 }}>
          {slide.visual}
        </div>

        {/* フッター */}
        <div className="px-6 pb-6 pt-4 border-t" style={{ borderColor: '#f1f5f9' }}>
          {/* ページインジケーター */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  background: i === step ? '#0f9ab1' : '#e2e8f0',
                }} />
            ))}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={goPrev}
                className="flex-none px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border"
                style={{ borderColor: '#e2e8f0', color: '#475569' }}>
                ← 戻る
              </button>
            )}
            {isLast ? (
              <button onClick={handleStart}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all text-white"
                style={{ background: 'linear-gradient(135deg, #0f9ab1 0%, #0e8fa3 100%)' }}>
                ダッシュボードへ →
              </button>
            ) : (
              <button onClick={goNext}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all text-white"
                style={{ background: 'linear-gradient(135deg, #0f9ab1 0%, #0e8fa3 100%)' }}>
                次へ →
              </button>
            )}
          </div>
          {!isLast && (
            <button onClick={dismiss}
              className="w-full mt-2 text-xs py-1 transition-colors"
              style={{ color: '#94a3b8' }}>
              スキップ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
