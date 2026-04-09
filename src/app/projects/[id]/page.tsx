'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectWithFields, CustomField, GeneratedAsset, AssetType, FieldType, CompletionSuggestion } from '@/types';
import { ASSET_TYPE_LABELS, FIELD_TYPE_LABELS, PROJECT_TYPE_LABELS } from '@/types';

// ============================================================
// カスタムフィールドエディター
// ============================================================
function CustomFieldRow({ field, onChange, onRemove, onCrawl, crawling }: {
  field: CustomField;
  onChange: (f: CustomField) => void;
  onRemove: () => void;
  onCrawl: () => void;
  crawling: boolean;
}) {
  const isInherited = field.inherited === 1;

  return (
    <div className={`rounded-md border p-3 space-y-2 ${isInherited ? 'inherited-field' : ''}`} style={{ borderColor: isInherited ? 'rgba(245,158,11,0.4)' : 'var(--border)' }}>
      {isInherited && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <span>⚠</span>
          <span>継承済み — 内容を確認・更新してください</span>
          <button className="ml-auto text-gray-500 hover:text-gray-300" onClick={() => onChange({ ...field, inherited: 0 })}>✓ 確認済み</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">ラベル</label>
          <input className="field-input text-xs" value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} placeholder="例: PRポイント" />
        </div>
        <div>
          <label className="field-label">種別</label>
          <select className="field-input text-xs" value={field.type} onChange={e => onChange({ ...field, type: e.target.value as FieldType })}>
            {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={onRemove} className="btn-danger w-full justify-center">削除</button>
        </div>
      </div>

      {field.type === 'select' && (
        <div>
          <label className="field-label">選択肢（カンマ区切り）</label>
          <input className="field-input text-xs"
            value={(() => { try { return JSON.parse(field.options || '[]').join(', '); } catch { return ''; } })()}
            onChange={e => onChange({ ...field, options: JSON.stringify(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) })}
            placeholder="選択肢A, 選択肢B, 選択肢C"
          />
        </div>
      )}

      <div>
        <label className="field-label">値</label>
        {field.type === 'textarea' ? (
          <textarea className="field-input text-xs" rows={3} value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
        ) : field.type === 'select' ? (
          <select className="field-input text-xs" value={field.value} onChange={e => onChange({ ...field, value: e.target.value })}>
            <option value="">（選択してください）</option>
            {(() => { try { return JSON.parse(field.options || '[]') as string[]; } catch { return []; } })().map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : field.type === 'url' ? (
          <div className="flex gap-2">
            <input className="field-input text-xs flex-1" type="url" value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} placeholder="https://" />
            <button onClick={onCrawl} disabled={crawling || !field.value} className="btn-secondary text-xs px-3 shrink-0">
              {crawling ? '取得中...' : 'クロール'}
            </button>
          </div>
        ) : (
          <input className="field-input text-xs" type={field.type === 'date' ? 'date' : 'text'} value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
        )}
        {field.crawled_content && (
          <p className="text-xs mt-1 text-green-400">✓ URL内容取得済み ({field.crawled_content.length} 文字)</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 生成アセット表示
// ============================================================
function AssetCard({ asset, onDelete }: { asset: GeneratedAsset; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const warnings = (() => { try { return JSON.parse(asset.warnings) as string[]; } catch { return []; } })();

  function copy() {
    navigator.clipboard.writeText(asset.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b cursor-pointer" style={{ borderColor: 'var(--border)' }} onClick={() => setExpanded(e => !e)}>
        <div>
          <span className="text-xs font-semibold text-violet-300">{ASSET_TYPE_LABELS[asset.asset_type as AssetType] ?? asset.asset_type}</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(asset.created_at).toLocaleString('ja-JP')}</p>
        </div>
        <div className="flex items-center gap-2">
          {warnings.length > 0 && <span className="text-xs text-amber-400">⚠ {warnings.length}件</span>}
          <span className="text-gray-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4">
          {warnings.length > 0 && (
            <div className="mb-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs font-semibold text-amber-400 mb-1">整合性チェック</p>
              <ul className="text-xs text-amber-300 space-y-0.5">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            {asset.content}
          </pre>
          <div className="flex gap-2 mt-4">
            <button onClick={copy} className="btn-secondary text-xs">{copied ? '✓ コピー済み' : 'コピー'}</button>
            <button onClick={onDelete} className="btn-danger">削除</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithFields | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>(['lp', 'sns_twitter']);
  const [crawlingFieldId, setCrawlingFieldId] = useState<string | null>(null);
  const [tab, setTab] = useState<'fields' | 'assets'>('fields');

  const loadProject = useCallback(async () => {
    const [pr, ar] = await Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/assets`).then(r => r.json()),
    ]);
    setProject(pr as ProjectWithFields);
    setAssets(ar as GeneratedAsset[]);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  async function save(p: ProjectWithFields) {
    setSaving(true);
    const channels = (() => { try { return JSON.parse(p.channels) as string[]; } catch { return []; } })();
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, channels, custom_fields: p.custom_fields }),
    });
    setSaving(false);
    setSavingMsg('保存済み');
    setTimeout(() => setSavingMsg(''), 2000);
  }

  function updateField(idx: number, f: CustomField) {
    if (!project) return;
    const fields = [...project.custom_fields];
    fields[idx] = f;
    setProject({ ...project, custom_fields: fields });
  }

  function addField() {
    if (!project) return;
    const newField: CustomField = {
      id: uuidv4(),
      project_id: id,
      key: `field_${Date.now()}`,
      label: '',
      type: 'text',
      value: '',
      options: '[]',
      inherited: 0,
      inherited_from: null,
      crawled_content: null,
      sort_order: project.custom_fields.length,
    };
    setProject({ ...project, custom_fields: [...project.custom_fields, newField] });
  }

  function removeField(idx: number) {
    if (!project) return;
    const fields = project.custom_fields.filter((_, i) => i !== idx);
    setProject({ ...project, custom_fields: fields });
  }

  async function crawlField(fieldId: string) {
    setCrawlingFieldId(fieldId);
    try {
      const res = await fetch(`/api/projects/${id}/crawl`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field_id: fieldId }) });
      if (res.ok) await loadProject();
    } finally {
      setCrawlingFieldId(null);
    }
  }

  async function generate() {
    if (!project || selectedAssetTypes.length === 0) return;
    await save(project);
    setGenerating(true);
    try {
      await fetch(`/api/projects/${id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_types: selectedAssetTypes }) });
      await loadProject();
      setTab('assets');
    } finally {
      setGenerating(false);
    }
  }

  async function complete() {
    if (!project) return;
    await save(project);
    setCompleting(true);
    try {
      const res = await fetch(`/api/projects/${id}/complete`, { method: 'POST' });
      const data = await res.json() as { suggestions: CompletionSuggestion[] };
      setSuggestions(data.suggestions ?? []);
    } finally {
      setCompleting(false);
    }
  }

  function applySuggestion(s: CompletionSuggestion) {
    if (!project) return;
    const fields = project.custom_fields.map(f => f.id === s.field_id ? { ...f, value: s.suggested_value } : f);
    setProject({ ...project, custom_fields: fields });
    setSuggestions(sug => sug.filter(ss => ss.field_id !== s.field_id));
  }

  async function deleteAsset(assetId: string) {
    await fetch(`/api/projects/${id}/assets?assetId=${assetId}`, { method: 'DELETE' });
    setAssets(a => a.filter(x => x.id !== assetId));
  }

  async function deleteProject() {
    if (!confirm('このプロジェクトを削除しますか？')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    router.push('/');
  }

  if (!project) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
      <p>読み込み中...</p>
    </div>
  );

  const channels = (() => { try { return JSON.parse(project.channels) as string[]; } catch { return []; } })();
  const inheritedCount = project.custom_fields.filter(f => f.inherited === 1).length;

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-300 text-sm">← 戻る</button>
        <div className="flex-1 min-w-0">
          <input
            className="bg-transparent text-lg font-bold w-full focus:outline-none border-b border-transparent focus:border-gray-600 transition-colors"
            value={project.name}
            onChange={e => setProject({ ...project, name: e.target.value })}
          />
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-violet-300">{PROJECT_TYPE_LABELS[project.type] ?? project.type}</span>
            {project.cloned_from && <span className="text-xs text-gray-500">• クローン</span>}
            {inheritedCount > 0 && <span className="text-xs text-amber-400">• 要確認フィールド {inheritedCount}件</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savingMsg && <span className="text-xs text-green-400">{savingMsg}</span>}
          <select className="field-input text-xs w-auto" value={project.status} onChange={e => setProject({ ...project, status: e.target.value as typeof project.status })}>
            <option value="draft">下書き</option>
            <option value="active">実施中</option>
            <option value="archived">アーカイブ</option>
          </select>
          <button onClick={() => save(project)} disabled={saving} className="btn-primary text-sm">
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={deleteProject} className="btn-danger text-xs">削除</button>
        </div>
      </div>

      {/* 本体 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左: フィールド編集 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* タブ切り替え */}
          <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            {[{ k: 'fields' as const, l: 'プロジェクト情報' }, { k: 'assets' as const, l: `生成済みアセット (${assets.length})` }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${tab === t.k ? 'bg-violet-700/20 text-violet-300' : 'text-gray-400 hover:text-gray-200'}`}>
                {t.l}
              </button>
            ))}
          </div>

          {tab === 'fields' ? (
            <>
              {/* コアフィールド */}
              <section>
                <h2 className="section-title mb-3">基本情報 (Project Core)</h2>
                <div className="card p-5 grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">種別</label>
                    <select className="field-input" value={project.type} onChange={e => setProject({ ...project, type: e.target.value as typeof project.type })}>
                      {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">ターゲット</label>
                    <input className="field-input" value={project.target} onChange={e => setProject({ ...project, target: e.target.value })} placeholder="例: 30代 BtoB マーケター" />
                  </div>
                  <div>
                    <label className="field-label">開始日</label>
                    <input className="field-input" type="date" value={project.start_date} onChange={e => setProject({ ...project, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">終了日</label>
                    <input className="field-input" type="date" value={project.end_date} onChange={e => setProject({ ...project, end_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">予算</label>
                    <input className="field-input" value={project.budget} onChange={e => setProject({ ...project, budget: e.target.value })} placeholder="例: ¥500,000" />
                  </div>
                  <div>
                    <label className="field-label">チャネル（カンマ区切り）</label>
                    <input className="field-input" value={channels.join(', ')} onChange={e => setProject({ ...project, channels: JSON.stringify(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) })} placeholder="Web, SNS, メール" />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">概要</label>
                    <textarea className="field-input" rows={3} value={project.description} onChange={e => setProject({ ...project, description: e.target.value })} placeholder="施策の目的・背景・概要を記述" />
                  </div>
                </div>
              </section>

              {/* カスタムフィールド */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-title">カスタムフィールド (Project Custom)</h2>
                  <button onClick={addField} className="btn-secondary text-xs py-1 px-3">+ フィールド追加</button>
                </div>
                {project.custom_fields.length === 0 ? (
                  <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm">カスタムフィールドがありません</p>
                    <p className="text-xs mt-1">PRポイント、技術的ハイライト、参照URLなど施策固有の情報を追加できます</p>
                    <button onClick={addField} className="btn-secondary text-xs mt-3">+ フィールドを追加</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.custom_fields.map((f, i) => (
                      <CustomFieldRow
                        key={f.id}
                        field={f}
                        onChange={nf => updateField(i, nf)}
                        onRemove={() => removeField(i)}
                        onCrawl={() => crawlField(f.id)}
                        crawling={crawlingFieldId === f.id}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* AI補完サジェスト */}
              {suggestions.length > 0 && (
                <section>
                  <h2 className="section-title mb-3">AI補完サジェスト</h2>
                  <div className="space-y-2">
                    {suggestions.map(s => (
                      <div key={s.field_id} className="card p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-violet-300">{s.label}</p>
                          <p className="text-sm mt-1">{s.suggested_value}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.reason}</p>
                        </div>
                        <button onClick={() => applySuggestion(s)} className="btn-primary text-xs shrink-0">適用</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section>
              {assets.length === 0 ? (
                <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <p>まだアセットが生成されていません</p>
                  <p className="text-xs mt-1">右パネルからアセットタイプを選んで生成してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assets.map(a => <AssetCard key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />)}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 右: AI生成パネル */}
        <div className="w-72 shrink-0 border-l overflow-y-auto p-5 space-y-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="section-title">AI生成エンジン</h2>

          {/* アセットタイプ選択 */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>生成するアセット</p>
            <div className="space-y-1.5">
              {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([type, label]) => (
                <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedAssetTypes.includes(type)}
                    onChange={e => setSelectedAssetTypes(prev => e.target.checked ? [...prev, type] : prev.filter(t => t !== type))}
                    className="accent-violet-500"
                  />
                  <span className={`text-sm transition-colors ${selectedAssetTypes.includes(type) ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 生成ボタン */}
          <button
            onClick={generate}
            disabled={generating || selectedAssetTypes.length === 0}
            className="btn-primary w-full justify-center py-2.5"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                生成中...
              </span>
            ) : `選択中の ${selectedAssetTypes.length} 種類を生成`}
          </button>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>フィールド自動補完</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>既存の情報を元に、未入力フィールドの値をAIが推測します</p>
            <button onClick={complete} disabled={completing} className="btn-secondary w-full justify-center text-sm">
              {completing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  分析中...
                </span>
              ) : 'AI補完を実行'}
            </button>
          </div>

          {/* 参照情報サマリー */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mb-2 section-title">AIへの参照スコープ</p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
              <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Global Assets</li>
              <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> プロジェクトコア情報</li>
              <li className="flex items-center gap-1.5"><span className={project.custom_fields.length > 0 ? 'text-green-400' : 'text-gray-600'}>
                {project.custom_fields.length > 0 ? '✓' : '−'}
              </span> カスタムフィールド ({project.custom_fields.length}件)</li>
              <li className="flex items-center gap-1.5"><span className={project.custom_fields.some(f => f.crawled_content) ? 'text-green-400' : 'text-gray-600'}>
                {project.custom_fields.some(f => f.crawled_content) ? '✓' : '−'}
              </span> クロール済みURL</li>
            </ul>
          </div>

          {inheritedCount > 0 && (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs text-amber-400 font-semibold">⚠ 継承フィールドあり</p>
              <p className="text-xs text-amber-300 mt-1">{inheritedCount}件のフィールドが前回施策から継承されています。生成前に確認を推奨します。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
