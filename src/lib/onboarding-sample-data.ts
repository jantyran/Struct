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
        target, start_date, end_date, budget, channels, description, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    );

    db.prepare(`
      INSERT INTO projects (
        id, name, type, phase_key, status, organization_id, owner_id, primary_assignee_id,
        target, start_date, end_date, budget, channels, description, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      [userGuideProjectId, 'learning_goal', 'このプロジェクトで学ぶこと', 'textarea', 'ダッシュボード、プロジェクト詳細、タスク、ノート、シート、マスターデータ、レポート、マイページ設定の基本操作。', '学習ガイド', 0],
      [userGuideProjectId, 'recommended_order', 'おすすめの進め方', 'textarea', 'タスクを上から順に開き、説明を読んで実際の画面を操作してください。終わったタスクは完了にします。', '学習ガイド', 1],
      [adminGuideProjectId, 'admin_learning_goal', '管理者が確認すること', 'textarea', '組織設定、マスターデータ、ユーザー管理、ロール権限、プロジェクト種別、生成コンテンツ設定、AI設定の場所と役割。', '管理者ガイド', 0],
      [practiceProjectId, 'target', '目的', 'textarea', '新規プロジェクトを追加したあと、基本情報とタスクを整理する練習用。', '基本情報', 0],
    ];
    for (const [projectId, key, label, type, value, section, sortOrder] of fields) {
      db.prepare(`
        INSERT INTO custom_fields
          (id, project_id, key, label, type, value, options, layout, sort_order, is_builtin, section)
        VALUES (?, ?, ?, ?, ?, ?, '{}', 'full', ?, 1, ?)
      `).run(uuidv4(), projectId, key, label, type, value, sortOrder, section);
    }

    const userTodos: SampleTodo[] = [
      { projectId: userGuideProjectId, title: '1. ダッシュボードでプロジェクト一覧と自分のタスクを見る', description: '左メニューの「ダッシュボード」を開き、プロジェクト数、未完了タスク、期限が近いタスクがどこに出るか確認します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 1, sortOrder: 0 },
      { projectId: userGuideProjectId, title: '2. プロジェクト詳細画面で概要・項目・メンバーを確認する', description: 'このプロジェクトを開き、概要、カスタム項目、メンバー、関係者がどこに表示されるか確認します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 2, sortOrder: 1 },
      { projectId: userGuideProjectId, title: '3. タスクの担当者・期限・状態を変更する', description: 'タスク画面でこのタスクを開き、状態を進行中に変えます。担当者や期限の表示も確認します。', status: 'todo', priority: 'medium', assigneeId: memberId, dueInDays: 3, sortOrder: 2 },
      { projectId: userGuideProjectId, title: '4. 新しいプロジェクトを追加してみる', description: 'ダッシュボードの新規作成から、練習用のプロジェクトを1件作成します。作成後は名前、種別、フェーズを確認します。', status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 4, sortOrder: 3 },
      { projectId: userGuideProjectId, title: '5. ノートに打ち合わせメモを残す', description: 'プロジェクト詳細のノートで、短いメモを作成します。後から見返す情報を置く場所として使います。', status: 'todo', priority: 'medium', assigneeId: memberId, dueInDays: 5, sortOrder: 4 },
      { projectId: userGuideProjectId, title: '6. シートでチェックリストを編集する', description: 'シートを開き、行を追加または状態を書き換えます。表形式で管理したい情報の置き場を確認します。', status: 'todo', priority: 'low', assigneeId: memberId, dueInDays: 6, sortOrder: 5 },
      { projectId: userGuideProjectId, title: '7. マスターデータで取引先・商品サンプルを見る', description: '左メニューの「マスターデータ」を開き、取引先と商品・サービスのサンプルレコードを確認します。プロジェクト外で共通利用する情報の置き場です。', status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 7, sortOrder: 6 },
      { projectId: userGuideProjectId, title: '8. レポート画面で自分の状況を見る', description: '左メニューの「レポート」を開き、担当タスクやプロジェクトの状況がどのように見えるか確認します。', status: 'todo', priority: 'low', assigneeId: adminId, dueInDays: 8, sortOrder: 7 },
      { projectId: userGuideProjectId, title: '9. マイページでタスク表示設定を変更する', description: 'マイページまたは個人設定を開き、タスク表示や文字サイズなど自分向け設定を確認します。', status: 'todo', priority: 'low', assigneeId: adminId, dueInDays: 9, sortOrder: 8 },
    ];

    const adminTodos: SampleTodo[] = [
      { projectId: adminGuideProjectId, title: '1. 組織設定で会社情報と基本設定を確認する', description: '設定画面から組織設定を開き、会社名、説明、ロケールなどの管理場所を確認します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 1, sortOrder: 0 },
      { projectId: adminGuideProjectId, title: '2. マスターデータで共通情報を管理する', description: 'マスターデータを開き、取引先や商品・サービスの項目とレコードを確認します。必要に応じてレコード追加も試します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 2, sortOrder: 1 },
      { projectId: adminGuideProjectId, title: '3. ユーザー管理でサンプルユーザーを確認する', description: '設定のユーザー管理で、サンプル一般ユーザーとレビュアーが存在することを確認します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 3, sortOrder: 2 },
      { projectId: adminGuideProjectId, title: '4. ロール権限管理で管理者と一般ユーザーの違いを見る', description: 'ロール設定を開き、SYSTEM_ADMIN、MANAGER、USER が持つ権限の違いを確認します。', status: 'todo', priority: 'high', assigneeId: adminId, dueInDays: 4, sortOrder: 3 },
      { projectId: adminGuideProjectId, title: '5. プロジェクト設定で種別・フェーズ・項目を確認する', description: 'プロジェクト種別設定を開き、プロジェクトの入力項目やフェーズがどのように定義されるか確認します。', status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 5, sortOrder: 4 },
      { projectId: adminGuideProjectId, title: '6. 生成コンテンツ設定でテンプレートを確認する', description: 'コンテンツテンプレート設定を開き、AI生成時に使う指示や形式をどこで管理するか確認します。', status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 6, sortOrder: 5 },
      { projectId: adminGuideProjectId, title: '7. AI設定の登録場所を確認する', description: 'AI設定画面を開き、APIキーやモデル設定を登録する場所を確認します。実キーは必要になってから登録します。', status: 'todo', priority: 'medium', assigneeId: adminId, dueInDays: 7, sortOrder: 6 },
      { projectId: adminGuideProjectId, title: '8. 運用前チェック: 不要なサンプルデータの扱いを決める', description: '本番運用前に、このサンプルプロジェクトを残すか、完了・アーカイブ・削除するか決めます。', status: 'todo', priority: 'low', assigneeId: adminId, dueInDays: 8, sortOrder: 7 },
    ];

    for (const todo of [...userTodos, ...adminTodos]) insertTodo(db, adminId, todo);

    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), userGuideProjectId, 'このプロジェクトの使い方', [
      'このプロジェクトは、Struct の基本操作をタスク形式で学ぶためのものです。',
      'タスクを上から順に進め、実際に画面を操作したらタスクを完了にしてください。',
      'サンプル一般ユーザーのログイン情報: sample.member@example.invalid / sample1234',
    ].join('\n'), adminId);

    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), adminGuideProjectId, '管理者向けトレーニングの使い方', [
      'このプロジェクトは、管理者が設定画面でできることを確認するためのものです。',
      '権限や設定を変更する前に、何を変える設定なのかをタスク説明で確認してください。',
      '本番運用前に不要なサンプルユーザー、マスターデータ、プロジェクトを整理してください。',
    ].join('\n'), adminId);

    db.prepare(`
      INSERT INTO project_contacts (id, project_id, name, email, phone, company_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userGuideProjectId, '練習用 外部担当者', 'partner@example.invalid', '03-0000-0000', 'サンプルパートナー株式会社');

    db.prepare(`
      INSERT INTO project_sheets (id, project_id, name, columns_def, rows_data, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      userGuideProjectId,
      '操作練習チェックリスト',
      JSON.stringify([{ id: 'step', name: '練習内容', type: 'text' }, { id: 'screen', name: '画面', type: 'text' }, { id: 'status', name: '状態', type: 'text' }]),
      JSON.stringify([
        { id: uuidv4(), step: 'タスクの状態を変更する', screen: 'プロジェクト詳細 > タスク', status: '未着手' },
        { id: uuidv4(), step: 'マスターデータを見る', screen: 'マスターデータ', status: '未着手' },
        { id: uuidv4(), step: 'レポートを見る', screen: 'レポート', status: '未着手' },
      ]),
      adminId,
    );

    db.prepare(`
      INSERT INTO project_sheets (id, project_id, name, columns_def, rows_data, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      adminGuideProjectId,
      '管理者設定チェックリスト',
      JSON.stringify([{ id: 'area', name: '設定領域', type: 'text' }, { id: 'purpose', name: '確認すること', type: 'text' }, { id: 'done', name: '確認状況', type: 'text' }]),
      JSON.stringify([
        { id: uuidv4(), area: 'マスターデータ', purpose: '共通データの項目とレコード', done: '未確認' },
        { id: uuidv4(), area: 'ユーザー管理', purpose: 'ユーザー追加とロール変更の場所', done: '未確認' },
        { id: uuidv4(), area: '生成コンテンツ設定', purpose: 'テンプレートとAI設定の管理', done: '未確認' },
      ]),
      adminId,
    );
  });

  tx();
}
