import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

export default function AboutPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card p-8 md:p-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
            About Struct
          </p>
          <h1 className="text-3xl font-bold mt-2">マーケティング施策を、入力済みの資産として蓄積する</h1>
          <p className="text-sm mt-3 leading-7" style={{ color: 'var(--text-secondary)' }}>
            Struct は、案件ごとの断片的なメモや素材を、再利用できる構造化データとして管理するためのアプリです。
            プロジェクト情報、ブランド情報、生成済みアセットを一箇所にまとめ、次の施策に流用しやすくします。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['プロジェクト管理', '施策単位で目的、期間、チャネル、補足情報をまとめて管理します。'],
            ['Global Assets', '会社情報やブランドトーンなど、横断利用する前提情報を保持します。'],
            ['AI 活用', '不足情報の補完や、複数チャネル向けアセット生成のベースとして利用できます。'],
          ].map(([title, body]) => (
            <section key={title} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="text-xs mt-2 leading-6" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </section>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Link href={withBasePath('/guide')} className="btn-secondary">
            使い方を見る
          </Link>
          <Link href={withBasePath('/signup')} className="btn-primary">
            新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}
