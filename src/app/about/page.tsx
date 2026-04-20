import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

const pillars = [
  {
    eyebrow: 'Design',
    title: '業務ごとの管理構造を先に設計できる',
    body: 'セクション、項目、参照関係、AI参照範囲まで定義し、チームごとの運用ルールをそのまま管理画面に落とし込めます。',
  },
  {
    eyebrow: 'Operate',
    title: '情報と進行を同じプロジェクト上で動かせる',
    body: 'ノート、タスク、生成コンテンツ、関連情報が分断されず、実行に必要な文脈ごと管理できます。',
  },
  {
    eyebrow: 'Reuse',
    title: '案件が終わっても使える形で情報が残る',
    body: '属人的なメモではなく、次の案件やAI活用に再利用できる構造化データとして蓄積されます。',
  },
];

const comparisons = [
  {
    label: '管理の起点',
    conventional: 'タスクや課題を登録して運用を始める',
    struct: '先に業務の型を定義してから、案件ごとの実行を積み上げる',
  },
  {
    label: '主役になる情報',
    conventional: '担当者、期日、進捗の追跡が中心',
    struct: '前提情報、入力項目、成果物、実行状況を一体で管理する',
  },
  {
    label: 'AI活用の前提',
    conventional: 'その場の文章やメモをもとに補助することが多い',
    struct: '構造化された項目と関連情報を根拠にして生成運用へつなげる',
  },
];

const useCases = [
  'マーケティング施策の進行と成果物をまとめて管理したい',
  '営業企画や事業企画で、案件ごとに必要な入力項目を標準化したい',
  '案件ごとに散らばる前提情報や判断材料を一箇所にまとめたい',
  'AI生成を使う前提として、参照情報をきちんと整備したい',
];

const outcomes = [
  '案件ごとに必要な入力が揃いやすくなる',
  'ノート、成果物、タスクが分断されにくくなる',
  '属人的な運用から、再利用できる運用へ移しやすい',
  '部門や案件ごとの管理フォーマットを標準化しやすい',
];

export default function AboutPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <section
        className="card overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(236, 254, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 48%, rgba(255, 247, 237, 0.94) 100%)',
        }}
      >
        <div className="px-8 py-10 md:px-10 md:py-12">
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(14, 165, 233, 0.10)', color: 'rgb(3, 105, 161)' }}>
              About Struct
            </span>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(16, 185, 129, 0.10)', color: 'rgb(4, 120, 87)' }}>
              プロジェクト・施策管理ツール
            </span>
          </div>
          <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-8 items-start">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                タスクを管理するだけではない。
                <br />
                業務の構造から管理する。
              </h1>
              <p className="text-base mt-5 leading-8 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
                Struct は、プロジェクトや施策の進行を追うだけでなく、その案件で必要になる項目、前提情報、ノート、成果物まで含めて
                構造化して管理するためのツールです。案件ごとの実行を整理しながら、次にも使える情報資産として蓄積できます。
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link href={withBasePath('/signup')} className="btn-primary">
                  Struct を使い始める
                </Link>
                <Link href={withBasePath('/guide')} className="btn-secondary">
                  使い方を見る
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'rgba(14, 165, 233, 0.18)', background: 'rgba(255, 255, 255, 0.84)' }}>
              <div>
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                  Struct In One Line
                </p>
                <p className="text-lg font-semibold mt-2">
                  プロジェクトと施策を、業務の型から運用できる管理ツール
                </p>
              </div>
              <div className="space-y-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                <p>・管理項目を先に設計できる</p>
                <p>・共通資産、ノート、成果物、タスクを一体で扱える</p>
                <p>・AIを構造化データに接続できる</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {pillars.map((item) => (
          <div key={item.title} className="card p-5">
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              {item.eyebrow}
            </p>
            <h2 className="text-lg font-semibold mt-2 leading-7">{item.title}</h2>
            <p className="text-sm mt-3 leading-7" style={{ color: 'var(--text-secondary)' }}>
              {item.body}
            </p>
          </div>
        ))}
      </section>

      <section className="card p-8 md:p-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Why Struct
          </p>
          <h2 className="text-2xl md:text-3xl font-bold mt-2">これまでの管理ツールでは拾いきれなかったものを扱う</h2>
          <p className="text-sm mt-4 leading-8" style={{ color: 'var(--text-secondary)' }}>
            一般的な他社ツールは、担当者や期限、進捗の管理には強い一方で、案件ごとに必要な情報の型や、成果物を支える前提情報まで
            ひとつの構造で扱うことは得意ではありません。Struct は、進行管理と情報設計を分けずに扱うために作られています。
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {comparisons.map((row) => (
            <div key={row.label} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--border)', background: 'rgba(15, 23, 42, 0.02)' }}>
                {row.label}
              </div>
              <div className="grid md:grid-cols-2">
                <div className="px-5 py-4 border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                    一般的な他社ツール
                  </p>
                  <p className="text-sm mt-2 leading-7" style={{ color: 'var(--text-secondary)' }}>
                    {row.conventional}
                  </p>
                </div>
                <div className="px-5 py-4" style={{ background: 'rgba(20, 184, 166, 0.07)' }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
                    Struct
                  </p>
                  <p className="text-sm mt-2 leading-7" style={{ color: 'var(--text-secondary)' }}>
                    {row.struct}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="card p-6 md:p-7">
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Fit
          </p>
          <h2 className="text-2xl font-bold mt-2">Struct が向いているケース</h2>
          <div className="mt-5 space-y-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
            {useCases.map((item) => (
              <p key={item}>・{item}</p>
            ))}
          </div>
        </div>

        <div className="card p-6 md:p-7">
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Outcome
          </p>
          <h2 className="text-2xl font-bold mt-2">使うことで得やすい変化</h2>
          <div className="mt-5 space-y-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
            {outcomes.map((item) => (
              <p key={item}>・{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-8 md:p-10 text-center">
        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          Start With Struct
        </p>
        <h2 className="text-2xl md:text-3xl font-bold mt-2">プロジェクトを管理するだけで終わらせない</h2>
        <p className="text-sm mt-4 leading-8 max-w-3xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Struct は、案件の進行管理をしながら、その案件で生まれる情報や成果物を次に使える形で残していくための土台です。
          プロジェクト・施策管理を、より構造的に進めたいチームに向いています。
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-7">
          <Link href={withBasePath('/guide')} className="btn-secondary">
            使い方を見る
          </Link>
          <Link href={withBasePath('/signup')} className="btn-primary">
            新規登録
          </Link>
        </div>
      </section>
    </div>
  );
}
