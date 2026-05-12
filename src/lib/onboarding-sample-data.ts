import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { buildOrganizationSettingsScopeKey } from '@/lib/organization-settings';

interface SeedOnboardingSampleDataOptions {
  adminId: string;
  organizationId: string;
}

interface SampleTodo {
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string;
  dueInDays: number;
  sortOrder: number;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function insertTodo(db: Database.Database, adminId: string, todo: SampleTodo) {
  const completedAt = todo.status === 'done' ? new Date().toISOString() : null;
  db.prepare(`
    INSERT INTO todos
      (id, project_id, title, description, status, priority, assignee_id, due_date, sort_order, created_by, completed_at, completed_by, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    todo.projectId,
    todo.title,
    todo.description,
    todo.status,
    todo.priority,
    todo.assigneeId,
    dateOffset(todo.dueInDays),
    todo.sortOrder,
    adminId,
    completedAt,
    completedAt ? adminId : null,
    JSON.stringify(['onboarding']),
  );
}

function sampleMasterDataObjects() {
  return [
    {
      id: uuidv4(),
      key: 'companies',
      name: '取引先',
      description: 'プロジェクトで参照する会社・外部パートナーのサンプルです。',
      is_default: true,
      fields: [
        { id: uuidv4(), key: 'industry', label: '業種', type: 'text' },
        { id: uuidv4(), key: 'owner', label: '担当者', type: 'text' },
        { id: uuidv4(), key: 'memo', label: 'メモ', type: 'textarea' },
      ],
      records: [
        {
          id: uuidv4(),
          key: 'sample-partner',
          name: 'サンプルパートナー株式会社',
          values: { industry: '制作会社', owner: 'サンプル 一般ユーザー', memo: '練習プロジェクトの外部協力先です。' },
        },
        {
          id: uuidv4(),
          key: 'sample-client',
          name: 'サンプルクライアント株式会社',
          values: { industry: '小売', owner: '管理者', memo: 'レポート確認やプロジェクト紐づけの練習に使います。' },
        },
      ],
    },
    {
      id: uuidv4(),
      key: 'products',
      name: '商品・サービス',
      description: '施策対象の商品やサービスのサンプルです。',
      is_default: true,
      fields: [
        { id: uuidv4(), key: 'category', label: 'カテゴリ', type: 'text' },
        { id: uuidv4(), key: 'url', label: 'URL', type: 'url' },
        { id: uuidv4(), key: 'summary', label: '概要', type: 'textarea' },
      ],
      records: [
        {
          id: uuidv4(),
          key: 'struct-starter',
          name: 'Struct Starter',
          values: { category: 'SaaS', url: 'https://example.invalid/struct-starter', summary: '練習用の架空サービスです。' },
        },
        {
          id: uuidv4(),
          key: 'struct-pro',
          name: 'Struct Pro',
          values: { category: 'SaaS', url: 'https://example.invalid/struct-pro', summary: '管理者向け設定の練習で参照します。' },
        },
      ],
    },
  ];
}

export async function seedOnboardingSampleData(
  db: Database.Database,
  { adminId, organizationId }: SeedOnboardingSampleDataOptions,
) {
  const existingProjects = (db.prepare(
    'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?'
  ).get(organizationId) as { count: number }).count;
  if (existingProjects > 0) return;

  const samplePasswordHash = await bcrypt.hash('sample1234', 10);
  const memberId = uuidv4();
  const reviewerId = uuidv4();
  const userGuideProjectId = uuidv4();
  const adminGuideProjectId = uuidv4();
  const practiceProjectId = uuidv4();
  const createdAt = nowSql();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, avatar_url, organization_id, system_role)
      VALUES (?, ?, ?, ?, ?, ?, 'USER')
    `).run(memberId, 'sample.member@example.invalid', samplePasswordHash, 'サンプル 一般ユーザー', '', organizationId);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, avatar_url, organization_id, system_role)
      VALUES (?, ?, ?, ?, ?, ?, 'USER')
    `).run(reviewerId, 'sample.reviewer@example.invalid', samplePasswordHash, 'サンプル レビュアー', '', organizationId);

    db.prepare(`
      UPDATE organization_settings
      SET company_name = ?,
          company_description = ?,
          brand_voice = ?,
          brand_guidelines = ?,
          products = ?,
          objects = ?,
          updated_at = datetime('now')
      WHERE organization_id = ?
    `).run(
      'サンプル株式会社',
      'Struct の初回操作を練習するための架空組織です。',
      'わかりやすく、具体的で、実務にすぐ使えるトーン。',
      '固有名詞や数値は確認してから使う。社外向け文章では結論を先に書く。',
      JSON.stringify(['Struct Starter', 'Struct Pro']),
      JSON.stringify(sampleMasterDataObjects()),
      organizationId,
    );

    const settingsExists = (db.prepare(
      'SELECT COUNT(*) as count FROM organization_settings WHERE organization_id = ?'
    ).get(organizationId) as { count: number }).count;
    if (settingsExists === 0) {
      db.prepare(`
        INSERT INTO organization_settings (
          id, organization_id, scope_key, company_name, company_description,
          brand_voice, brand_guidelines, products, objects
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        organizationId,
        buildOrganizationSettingsScopeKey(organizationId),
        'サンプル株式会社',
        'Struct の初回操作を練習するための架空組織です。',
        'わかりやすく、具体的で、実務にすぐ使えるトーン。',
        '固有名詞や数値は確認してから使う。社外向け文章では結論を先に書く。',
        JSON.stringify(['Struct Starter', 'Struct Pro']),
        JSON.stringify(sampleMasterDataObjects()),
      );
    }

    db.prepare(`
      INSERT INTO projects (
        id, name, type, phase_key, status, organization_id, owner_id, primary_assignee_id,
        target, start_date, end_date, budget, channels, description, updated_at, is_onboarding
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userGuideProjectId,
      'はじめてのStruct: 全ユーザー向け練習プロジェクト',
      'campaign',
      'planning',
      'active',
      organizationId,
      adminId,
      adminId,
      'プロジェクト確認、タスク管理、マスターデータ参照、レポート確認、マイページ設定を体験する',
      dateOffset(0),
      dateOffset(14),
      '0',
      JSON.stringify(['ダッシュボード', 'プロジェクト詳細', 'タスク', 'マスターデータ', 'レポート', 'マイページ']),
      'Struct を使い始める全ユーザー向けの練習プロジェクトです。タスクを上から進めると、基本操作を順番に試せます。',
      createdAt,
      1,
    );

    db.prepare(`
      INSERT INTO projects (
        id, name, type, phase_key, status, organization_id, owner_id, primary_assignee_id,
        target, start_date, end_date, budget, channels, description, updated_at, is_onboarding
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminGuideProjectId,
      '管理者向け: Struct設定と権限管理トレーニング',
      'campaign',
      'planning',
      'active',
      organizationId,
      adminId,
      adminId,
      '組織設定、マスターデータ、ユーザー管理、ロール権限、プロジェクト設定、生成コンテンツ設定を確認する',
      dateOffset(0),
      dateOffset(21),
      '0',
      JSON.stringify(['設定', 'マスターデータ', 'ユーザー管理', 'ロール', 'AI設定', 'テンプレート']),
      '管理者だけが触る設定画面を安全に確認するための練習プロジェクトです。実運用前の確認チェックリストとして使えます。',
      createdAt,
      1,
    );

    db.prepare(`
      INSERT INTO projects (
        id, name, type, phase_key, status, organization_id, owner_id, primary_assignee_id,
        parent_project_id, target, start_date, end_date, budget, channels, description, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      practiceProjectId,
      '練習で作るプロジェクト例: 春のキャンペーン',
      'campaign',
      'production',
      'draft',
      organizationId,
      adminId,
      memberId,
      userGuideProjectId,
      '新規プロジェクト作成後の情報整理を練習する',
      dateOffset(3),
      dateOffset(30),
      '300000',
      JSON.stringify(['Web', 'メール']),
      '全ユーザー向け練習の途中で参照する、プロジェクト追加後の完成イメージです。',
      createdAt,
    );

    const memberRows = [
      [userGuideProjectId, adminId, 'PROJECT_MANAGER'],
      [userGuideProjectId, memberId, 'MEMBER'],
      [userGuideProjectId, reviewerId, 'GUEST'],
      [adminGuideProjectId, adminId, 'PROJECT_MANAGER'],
      [practiceProjectId, adminId, 'PROJECT_MANAGER'],
      [practiceProjectId, memberId, 'MEMBER'],
    ];
    for (const [projectId, userId, role] of memberRows) {
      db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), projectId, userId, role);
    }

    const fields = [
      [userGuideProjectId, 'description', '目的・背景', 'textarea', 'Struct を使い始める全ユーザーが、日常操作をタスク形式で学ぶためのプロジェクトです。タスクを上から進めることで、ダッシュボード、プロジェクト詳細、タスク、ノート、シート、マスターデータ、レポート、マイページ設定を確認できます。', '基本情報', 0],
      [userGuideProjectId, 'target', 'ターゲット', 'textarea', 'Struct を初めて使う一般ユーザー、プロジェクトメンバー、タスク担当者。', '基本情報', 1],
      [userGuideProjectId, 'kpi', '目標KPI・成果指標', 'textarea', '9件の学習タスクを完了し、日常操作の流れを一通り理解する。', '基本情報', 2],
      [userGuideProjectId, 'learning_goal', 'このプロジェクトで学ぶこと', 'textarea', 'ダッシュボード、プロジェクト詳細、タスク、ノート、シート、マスターデータ、レポート、マイページ設定の基本操作。', '学習ガイド', 3],
      [userGuideProjectId, 'recommended_order', 'おすすめの進め方', 'textarea', 'タスクを上から順に開き、説明を読んで実際の画面を操作してください。終わったタスクは完了にします。', '学習ガイド', 4],
      [adminGuideProjectId, 'description', '目的・背景', 'textarea', 'Struct の管理者が、運用開始前に設定画面と権限管理の全体像を確認するためのプロジェクトです。組織設定、マスターデータ、ユーザー管理、ロール、プロジェクト設定、生成コンテンツ設定、AI設定を順番に確認します。', '基本情報', 0],
      [adminGuideProjectId, 'target', 'ターゲット', 'textarea', 'Struct のシステム管理者、チーム管理者、運用設計を担当するメンバー。', '基本情報', 1],
      [adminGuideProjectId, 'kpi', '目標KPI・成果指標', 'textarea', '管理者向けチェックタスクを完了し、本番運用前に必要な設定箇所を把握する。', '基本情報', 2],
      [adminGuideProjectId, 'admin_learning_goal', '管理者が確認すること', 'textarea', '組織設定、マスターデータ、ユーザー管理、ロール権限、プロジェクト種別、生成コンテンツ設定、AI設定の場所と役割。', '管理者ガイド', 3],
      [practiceProjectId, 'description', '目的・背景', 'textarea', '新規プロジェクトを追加したあと、基本情報とタスクを整理する練習用の例です。全ユーザー向け練習プロジェクトのタスク「新しいプロジェクトを追加してみる」で参照できます。', '基本情報', 0],
      [practiceProjectId, 'target', 'ターゲット', 'textarea', '春のキャンペーンを担当するプロジェクトメンバーとレビュー担当者。', '基本情報', 1],
      [practiceProjectId, 'kpi', '目標KPI・成果指標', 'textarea', 'プロジェクト名、目的、ターゲット、タスク、担当者が入力された状態を確認する。', '基本情報', 2],
    ];
    for (const [projectId, key, label, type, value, section, sortOrder] of fields) {
      db.prepare(`
        INSERT INTO custom_fields
          (id, project_id, key, label, type, value, options, layout, sort_order, is_builtin, section)
        VALUES (?, ?, ?, ?, ?, ?, '{}', 'full', ?, 1, ?)
      `).run(uuidv4(), projectId, key, label, type, value, sortOrder, section);
    }

    // ──── ユーザー向け練習タスク（タスク管理の使い心地を体感する順序）────
    const userTodos: SampleTodo[] = [
      {
        projectId: userGuideProjectId,
        title: '1. ダッシュボードで全体を把握する',
        description: 'ダッシュボードを開き、プロジェクト一覧・自分のタスク数・今週の期限タスクを確認します。\n\n右サイドバーの「自分のタスク」にこのプロジェクトのタスクが並んでいます。タスク名をクリックすると直接そのタスクに飛べます。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 1, sortOrder: 0,
      },
      {
        projectId: userGuideProjectId,
        title: '2. リストビューでタスクを確認・ステータスを変更する',
        description: '「タスク」タブを開くとリストビューが表示されます。\n\n① このタスクをクリックして右側の詳細パネルを開いてください。\n② ステータスを「進行中」→「完了」に変えてみましょう。ステータスバッジを直接クリックしても変更できます。\n③ 担当者・期限・優先度フィールドも確認してください。\n\n※「練習で作るプロジェクト例」を開くと、より多くのサンプルタスクがリストに並んでいます。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 2, sortOrder: 1,
      },
      {
        projectId: userGuideProjectId,
        title: '3. カンバンビューでタスクをドラッグ移動する',
        description: 'タスクタブ右上のビュー切り替えボタンで「カンバン」を選択します。\n\n「未着手」「進行中」「完了」の3列にタスクが並びます。\n\n① カードをつかんで別の列にドラッグ&ドロップしてみてください。ステータスが自動で変わります。\n② 「練習で作るプロジェクト例」を開くと、各列にサンプルが入ったカンバンを確認できます。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 3, sortOrder: 2,
      },
      {
        projectId: userGuideProjectId,
        title: '4. ガントビューで期間と進捗を確認する',
        description: 'ビュー切り替えで「ガント」を選択します。\n\n① 期限が設定されたタスクが時系列バーとして表示されます。\n② バーの右端をドラッグして期限を伸ばしたり縮めたりできます。\n③ 期限未設定のタスクは左側の「未スケジュール」欄に表示されます。ガントにドラッグすると日程を設定できます。\n\n「練習で作るプロジェクト例」を開くと、本番に近いガントの見え方を確認できます。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 4, sortOrder: 3,
      },
      {
        projectId: userGuideProjectId,
        title: '5. 新しいタスクを作成する',
        description: 'リストビューに切り替えて「+ タスクを追加」ボタンからタスクを1件作成します。\n\n① タイトルを入力して Enter で確定します。\n② 作成されたタスクをクリックして詳細パネルを開き、担当者・期限・優先度を設定します。\n③ カンバンビューに切り替えて、作成したタスクが「未着手」列に追加されていることを確認します。',
        status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 5, sortOrder: 4,
      },
      {
        projectId: userGuideProjectId,
        title: '6. 新しいプロジェクトを作成する',
        description: 'ダッシュボード右上の「+ 新規プロジェクト」ボタンを押します。\n\n① 名前と種別を入力して作成します。\n② 作成後、プロジェクト詳細に遷移するので「項目」タブを確認します。種別に紐づいた入力項目が最初から並んでいます。\n\n「練習で作るプロジェクト例: 春のキャンペーン」が完成イメージとして参考になります。',
        status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 6, sortOrder: 5,
      },
      {
        projectId: userGuideProjectId,
        title: '7. ノートで情報を記録する',
        description: '「ノート」タブを開き、「+ 新しいノートを作成」からメモを1件作成します。\n\nノートはタスクとは別に、議事録・調査メモ・共有情報を置く場所です。Markdown で書けるので見出しや箇条書きも使えます。\n\n① タイトルと本文を入力して保存してください。\n② 固定ノートとしてピン留めすると、一覧の先頭に表示されます。',
        status: 'todo', priority: 'low', assigneeId: adminId, dueInDays: 7, sortOrder: 6,
      },
    ];

    // ──── 管理者向け練習タスク（プロジェクト内の項目カスタマイズに集中）────
    const adminTodos: SampleTodo[] = [
      {
        projectId: adminGuideProjectId,
        title: '1. プロジェクト種別設定で項目テンプレートを確認する',
        description: '左メニュー下部の「設定」→「プロジェクト種別設定」を開きます。\n\n種別（campaign / event など）を選択すると、その種別に紐づく「フェーズ」と「項目テンプレート」が表示されます。ここで定義した項目が、プロジェクト作成時に自動で入力欄として追加されます。\n\n「campaign」種別を開いて、デフォルトの項目一覧を確認してください。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 1, sortOrder: 0,
      },
      {
        projectId: adminGuideProjectId,
        title: '2. 新しい項目を追加してみる',
        description: 'プロジェクト種別設定の「campaign」を開き、「項目テンプレート」欄で「+ 項目を追加」を押します。\n\n① 種別を選びます（テキスト / テキストエリア / 選択肢 / 日付 / 数値など）。\n② ラベル（表示名）とキー（識別子）を入力します。\n③ 保存して、「基本情報」などのセクションに配置してみましょう。\n\nその後「練習で作るプロジェクト例」の「項目」タブを開き、追加した項目が反映されているか確認します。',
        status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 2, sortOrder: 1,
      },
      {
        projectId: adminGuideProjectId,
        title: '3. 項目の順序とセクションを変更する',
        description: 'プロジェクト種別設定で、項目をドラッグ&ドロップして並び替えます。\n\n① 項目の左端のハンドルをつかんで、上下に移動してみてください。\n② セクション間をまたいだ移動もできます（「基本情報」→「詳細情報」など）。\n\nセクションで情報をグループ化すると、プロジェクト詳細の「項目」タブが見やすくなります。変更後は保存を忘れずに。',
        status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 3, sortOrder: 2,
      },
      {
        projectId: adminGuideProjectId,
        title: '4. 不要な項目を削除・整理する',
        description: 'プロジェクト種別設定で、追加した練習用の項目を削除します。\n\n① 項目の右端にある削除ボタン（ゴミ箱アイコン）を押します。\n② 「目的・背景」「ターゲット」などの組み込み項目は削除できません（ロックアイコンが表示されます）。\n\n本番運用では、チームで使う項目だけに絞り込むと、プロジェクト作成時の入力負荷が下がります。',
        status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 4, sortOrder: 3,
      },
      {
        projectId: adminGuideProjectId,
        title: '5. 新規プロジェクトで項目設定の反映を確認する',
        description: 'ダッシュボードから「+ 新規プロジェクト」で campaign 種別のプロジェクトを新しく作成します。\n\n作成後に「項目」タブを開き、種別設定で定義した項目テンプレートが正しく反映されているか確認します。これで管理者が「プロジェクトの入力フォーム」をカスタマイズする仕組みの全体像が把握できます。\n\n確認が終わったら、このサンプルプロジェクト自体をアーカイブか削除して、本番運用を始めましょう。',
        status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 5, sortOrder: 4,
      },
    ];

    // ──── 練習プロジェクト（春のキャンペーン）のサンプルタスク ────
    // カンバン・ガントが映える混在ステータス・多様な期限
    const practiceTodos: SampleTodo[] = [
      { projectId: practiceProjectId, title: 'キャンペーン目標とKPIを設定する', description: '達成目標・対象ユーザー・主要KPIを定義する。', status: 'done', priority: 'high', assigneeId: adminId, dueInDays: -10, sortOrder: 0 },
      { projectId: practiceProjectId, title: 'ターゲットペルソナを作成する', description: 'メインターゲットのペルソナ（年齢・課題・行動パターン）をまとめる。', status: 'done', priority: 'high', assigneeId: memberId, dueInDays: -7, sortOrder: 1 },
      { projectId: practiceProjectId, title: '競合調査をまとめる', description: '主要競合3社のキャンペーン施策を調査してシートにまとめる。', status: 'done', priority: 'medium', assigneeId: memberId, dueInDays: -5, sortOrder: 2 },
      { projectId: practiceProjectId, title: 'LP構成案を作成する', description: 'ヒーローセクション・特徴・CTA の構成を決める。', status: 'in_progress', priority: 'high', assigneeId: adminId, dueInDays: 2, sortOrder: 3 },
      { projectId: practiceProjectId, title: 'コピーライティングを担当者に依頼する', description: 'キャッチコピー・本文テキストをライターに依頼する。', status: 'in_progress', priority: 'high', assigneeId: memberId, dueInDays: 3, sortOrder: 4 },
      { projectId: practiceProjectId, title: 'バナー素材をデザインする', description: 'Web・SNS・メール用バナーを各サイズで制作する。', status: 'in_progress', priority: 'medium', assigneeId: memberId, dueInDays: 5, sortOrder: 5 },
      { projectId: practiceProjectId, title: 'LP を実装・テストする', description: 'HTML/CSSコーディング・レスポンシブ確認・リンクチェック。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 8, sortOrder: 6 },
      { projectId: practiceProjectId, title: 'メール配信シナリオを設定する', description: '配信リスト・配信日時・A/Bテスト条件を設定する。', status: 'todo', priority: 'medium', assigneeId: memberId, dueInDays: 10, sortOrder: 7 },
      { projectId: practiceProjectId, title: '公開前レビューと最終承認', description: 'ステークホルダー確認・最終修正・公開承認フロー。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 12, sortOrder: 8 },
      { projectId: practiceProjectId, title: '公開・施策スタート', description: 'LP 公開・メール配信・SNS 投稿を実行する。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 14, sortOrder: 9 },
    ];

    for (const todo of [...userTodos, ...adminTodos, ...practiceTodos]) insertTodo(db, adminId, todo);

    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), userGuideProjectId, 'このプロジェクトの使い方', [
      '# Struct の使い方を体験する',
      '',
      'このプロジェクトは、タスク管理ツールとして Struct を使いこなすための練習プロジェクトです。',
      'タスクを上から順に進め、実際に操作したら完了にしてください。',
      '',
      '## ポイント',
      '- タスクはリスト / カンバン / ガント の3つのビューで確認できます',
      '- 「練習で作るプロジェクト例: 春のキャンペーン」を開くと、実際のプロジェクトに近いサンプルデータで各ビューを試せます',
      '- 各タスクの説明に具体的な操作手順が書かれています',
    ].join('\n'), adminId);

    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), adminGuideProjectId, '管理者向けトレーニングの使い方', [
      '# プロジェクトの入力項目をカスタマイズする',
      '',
      'このプロジェクトは、管理者が「プロジェクト種別設定」でフィールドをカスタマイズする方法を学ぶためのものです。',
      '',
      '## 学べること',
      '- プロジェクト種別ごとに入力項目のテンプレートを定義する方法',
      '- 項目の追加・削除・並び替え・セクション整理',
      '- 設定がプロジェクト詳細画面にどう反映されるかの確認方法',
      '',
      '## 操作場所',
      '左メニュー → 設定 → プロジェクト種別設定',
    ].join('\n'), adminId);

    db.prepare(`
      INSERT INTO project_contacts (id, project_id, name, email, phone, company_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userGuideProjectId, '練習用 外部担当者', 'partner@example.invalid', '03-0000-0000', 'サンプルパートナー株式会社');

  });

  tx();
}
