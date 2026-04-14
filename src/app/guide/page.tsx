import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

const steps = [
  {
    title: '1. アカウントを作成する',
    body: 'まずユーザー登録し、以後のプロジェクトや Global Assets を自分のワークスペースとして保持します。',
  },
  {
    title: '2. Global Assets を整える',
    body: '会社情報、ブランドボイス、製品情報、ガイドラインを入力し、生成時の共通前提を揃えます。',
  },
  {
    title: '3. プロジェクトを作る',
    body: '案件ごとに目的、期間、チャネル、説明を持ったプロジェクトを作成し、必要な入力を積み上げます。',
  },
  {
    title: '4. 生成と共有を進める',
    body: 'クロールや AI 補完を使って情報を整え、必要に応じてメンバー招待やクローンで横展開します。',
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
            初期導入では、共通資産を先に整えてから案件を作る順序が扱いやすいです。
            情報が資産として残る構造なので、単発の作業メモではなく再利用前提で入力するのがポイントです。
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <section key={step.title} className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold">{step.title}</h2>
              <p className="text-sm mt-2 leading-7" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>
            </section>
          ))}
        </div>

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
