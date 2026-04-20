import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

const steps = [
  {
    title: '1. 組織の前提を整える',
    body: '最初に組織基本設定、Global Assets、ロール・権限、AI設定を整えます。共通で使う定義を先に揃えると、後続の運用が安定します。',
  },
  {
    title: '2. プロジェクト設定を定義する',
    body: 'プロジェクト種別ごとにセクションや項目、AI参照設定、生成コンテンツ設定を定義します。管理したい業務の型をここで作ります。',
  },
  {
    title: '3. プロジェクトを作成して情報を入れる',
    body: '案件ごとにプロジェクトを作成し、定義済みの項目へ情報を入力します。必要に応じてノートや関連情報も追加します。',
  },
  {
    title: '4. タスクと成果物を運用する',
    body: 'タスク、ノート、生成コンテンツを同じプロジェクト上で管理します。AI生成では、設定した参照情報だけを根拠にドラフトを作成できます。',
  },
];

export default function GuidePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card p-8 md:p-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
            Guide
          </p>
          <h1 className="text-3xl font-bold mt-2">使い方</h1>
          <p className="text-sm mt-3 leading-7" style={{ color: 'var(--text-secondary)' }}>
            Struct は、設定を先に整えてからプロジェクト運用に入ると使いやすい構成です。
            項目や共通資産を定義したうえで使うと、業務ごとの差が出にくく、情報も再利用しやすくなります。
          </p>
        </div>

        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold">基本の考え方</h2>
          <div className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
            <p>Struct では、まず「何を管理するか」を定義し、そのうえで「案件ごとの実データ」を積み上げます。</p>
            <p>設定を後回しにして使い始めるより、最初にプロジェクト設定と共通情報を整えた方が、運用ルールを揃えやすくなります。</p>
          </div>
        </section>

        <div className="space-y-4">
          {steps.map((step) => (
            <section key={step.title} className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold">{step.title}</h2>
              <p className="text-sm mt-2 leading-7" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>
            </section>
          ))}
        </div>

        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold">最初に触るとよい設定</h2>
          <div className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
            <p>・組織基本設定: 組織名、タイムゾーン、ロケールなどの前提</p>
            <p>・Global Assets: 会社情報、ブランド、共通マスタ</p>
            <p>・プロジェクト設定: 項目、セクション、AI参照範囲</p>
            <p>・ロールと権限: 誰が何を見て変更できるか</p>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <Link href={withBasePath('/login')} className="btn-secondary">
            ログイン
          </Link>
          <Link href={withBasePath('/signup')} className="btn-primary">
            新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}
