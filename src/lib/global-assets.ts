import type { GlobalAssets, GlobalAssetField, GlobalAssetFieldType, GlobalAssetObject, GlobalAssetRecord } from '@/types';

const DEFAULT_OBJECTS: GlobalAssetObject[] = [
  {
    id: 'company-profile',
    key: 'company-profile',
    name: '会社情報',
    description: '全プロジェクト共通で使う企業プロフィールです。AI生成の文脈として参照されます。',
    is_default: true,
    fields: [
      { id: 'company-name',        key: 'company_name',        label: '会社名',             type: 'text' },
      { id: 'company-description', key: 'company_description', label: '会社概要・事業内容', type: 'textarea' },
      { id: 'company-industry',    key: 'industry',            label: '業種・業界',         type: 'text' },
      { id: 'company-website',     key: 'website_url',         label: '公式サイトURL',      type: 'url' },
    ],
    records: [{ id: 'company-profile-record', name: '会社情報', key: 'company_profile', values: { company_name: '', company_description: '', industry: '', website_url: '' } }],
  },
  {
    id: 'brand-guidelines',
    key: 'brand-guidelines',
    name: 'ブランド定義',
    description: 'ブランドボイスや表現上のルール・NGワード等を管理します。AI生成の品質に直結します。',
    is_default: true,
    fields: [
      { id: 'brand-voice',            key: 'brand_voice',       label: 'ブランドボイス・トーン', type: 'textarea' },
      { id: 'brand-tagline',          key: 'tagline',           label: 'タグライン・スローガン', type: 'text' },
      { id: 'brand-guidelines-field', key: 'brand_guidelines',  label: 'ブランドガイドライン',   type: 'textarea' },
      { id: 'brand-ng-words',         key: 'ng_words',          label: 'NGワード・禁止表現',     type: 'textarea' },
    ],
    records: [{ id: 'brand-guidelines-record', name: 'ブランド定義', key: 'brand_guidelines', values: { brand_voice: '', tagline: '', brand_guidelines: '', ng_words: '' } }],
  },
  {
    id: 'products-services',
    key: 'products-services',
    name: '製品・サービス',
    description: '提供中の製品やサービスを整理します。プロジェクトから参照することで施策の文脈を明確にします。',
    is_default: true,
    fields: [
      { id: 'product-name',        key: 'name',         label: '製品・サービス名', type: 'text' },
      { id: 'product-description', key: 'description',  label: '概要・説明',       type: 'textarea' },
      { id: 'product-features',    key: 'features',     label: '主な機能・特徴',   type: 'textarea' },
      { id: 'product-target',      key: 'target',       label: 'ターゲット顧客',   type: 'text' },
      { id: 'product-price',       key: 'price',        label: '価格帯・料金体系', type: 'text' },
      { id: 'product-url',         key: 'product_url',  label: '製品ページURL',    type: 'url' },
    ],
    records: [],
  },
  {
    id: 'personas',
    key: 'personas',
    name: 'ターゲットペルソナ',
    description: 'マーケティング施策のターゲットとなる人物像を定義します。プロジェクトから参照してAI生成の精度を高めます。',
    is_default: true,
    fields: [
      { id: 'persona-name',        key: 'persona_name',  label: 'ペルソナ名（例: 田中 健太）', type: 'text' },
      { id: 'persona-demographics',key: 'demographics',  label: '年齢・性別・居住地',          type: 'text' },
      { id: 'persona-role',        key: 'role_title',    label: '職種・役職・立場',            type: 'text' },
      { id: 'persona-pain',        key: 'pain_points',   label: '課題・悩み・ペインポイント',  type: 'textarea' },
      { id: 'persona-goals',       key: 'goals',         label: '目標・達成したいこと',        type: 'textarea' },
      { id: 'persona-channels',    key: 'channels_used', label: '普段使うメディア・チャネル',  type: 'text' },
      { id: 'persona-message',     key: 'message_resonance', label: '響くメッセージ・価値観', type: 'textarea' },
    ],
    records: [],
  },
];

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeField(field: Partial<GlobalAssetField>, index: number): GlobalAssetField {
  const key = (field.key || `field_${index + 1}`).trim() || `field_${index + 1}`;
  const type = (field.type || 'text') as GlobalAssetFieldType;

  return {
    id: field.id || `field-${index + 1}`,
    key,
    label: field.label?.trim() || key,
    type: ['text', 'textarea', 'url', 'number', 'date', 'reference', 'reference_multi'].includes(type) ? type : 'text',
    options: typeof field.options === 'string' && field.options ? field.options : '{}',
  };
}

function normalizeRecord(record: Partial<GlobalAssetRecord>, fields: GlobalAssetField[], index: number): GlobalAssetRecord {
  const values = Object.fromEntries(fields.map((field) => [field.key, record.values?.[field.key] ?? '']));
  const fallbackName = typeof values.name === 'string' && values.name.trim() ? values.name : `レコード ${index + 1}`;
  return {
    id: record.id || `record-${index + 1}`,
    name: record.name?.trim() || fallbackName,
    key: record.key?.trim() || `record_${index + 1}`,
    values,
  };
}

function normalizeObject(object: Partial<GlobalAssetObject>, index: number): GlobalAssetObject {
  const fields = safeArray<Partial<GlobalAssetField>>(object.fields).map(normalizeField);
  const normalizedFields: GlobalAssetField[] = fields.length > 0
    ? fields
    : [{ id: `field-${index + 1}`, key: 'name', label: '名称', type: 'text' }];

  return {
    id: object.id || `object-${index + 1}`,
    key: (object.key || `object_${index + 1}`).trim() || `object_${index + 1}`,
    name: object.name?.trim() || `オブジェクト ${index + 1}`,
    description: object.description ?? '',
    is_default: object.is_default === true,
    fields: normalizedFields,
    records: safeArray<Partial<GlobalAssetRecord>>(object.records).map((record, recordIndex) =>
      normalizeRecord(record, normalizedFields, recordIndex)
    ),
  };
}

export function defaultGlobalAssetObjects(): GlobalAssetObject[] {
  return DEFAULT_OBJECTS.map((object) => normalizeObject(object, 0));
}

export function createGlobalAssetObject(seed: Partial<GlobalAssetObject> = {}): GlobalAssetObject {
  return normalizeObject(
    {
      id: seed.id,
      key: seed.key,
      name: seed.name || '新しいオブジェクト',
      description: seed.description || '',
      is_default: seed.is_default,
      fields: seed.fields || [{ id: 'name-field', key: 'name', label: '名称', type: 'text' }],
      records: seed.records || [],
    },
    0
  );
}

function legacyObjectsFromRow(row: Record<string, unknown>): GlobalAssetObject[] {
  const defaults = defaultGlobalAssetObjects();
  const companyObject = defaults.find((object) => object.key === 'company-profile')!;
  const brandObject = defaults.find((object) => object.key === 'brand-guidelines')!;
  const productsObject = defaults.find((object) => object.key === 'products-services')!;

  companyObject.records = [
    {
      id: 'company-profile-record',
      name: '会社情報',
      key: 'company_profile',
      values: {
        company_name: (row?.company_name as string) || '',
        company_description: (row?.company_description as string) || '',
        industry: '',
        website_url: '',
      },
    },
  ];

  brandObject.records = [
    {
      id: 'brand-guidelines-record',
      name: 'ブランド定義',
      key: 'brand_guidelines',
      values: {
        brand_voice: (row?.brand_voice as string) || '',
        tagline: '',
        brand_guidelines: (row?.brand_guidelines as string) || '',
        ng_words: '',
      },
    },
  ];

  const products = safeArray<Record<string, string>>(safeJson<Record<string, string>[]>(row?.products as string | null | undefined, []));
  productsObject.records = products.map((product, index) => ({
    id: product?.id || `product-${index + 1}`,
    name: product?.name || `製品・サービス ${index + 1}`,
    key: product?.key || `products_services_${index + 1}`,
    values: {
      name: product?.name || '',
      description: product?.description || '',
      features: product?.features || '',
      target: product?.target || '',
      price: product?.price || '',
      product_url: product?.product_url || '',
    },
  }));

  return defaults;
}

export function normalizeGlobalAssets(data: Partial<GlobalAssets> | null | undefined): GlobalAssets {
  return {
    objects: safeArray<Partial<GlobalAssetObject>>(data?.objects).map(normalizeObject),
    updated_at: data?.updated_at ?? '',
  };
}

export function normalizeGlobalAssetsRow(row: Record<string, unknown>): GlobalAssets {
  const objects = row?.objects
    ? normalizeGlobalAssets({ objects: safeJson<GlobalAssetObject[]>(row.objects as string, []), updated_at: row.updated_at as string | undefined }).objects
    : legacyObjectsFromRow(row);

  return {
    objects,
    updated_at: (row?.updated_at as string) || '',
  };
}

export function serializeGlobalAssetObjects(objects: GlobalAssetObject[]): string {
  return JSON.stringify(normalizeGlobalAssets({ objects }).objects);
}

export function deriveLegacyGlobalAssetColumns(objects: GlobalAssetObject[]) {
  const normalized = normalizeGlobalAssets({ objects }).objects;
  const companyRecord = normalized.find((object) => object.key === 'company-profile')?.records[0];
  const brandRecord = normalized.find((object) => object.key === 'brand-guidelines')?.records[0];
  const products = normalized.find((object) => object.key === 'products-services')?.records ?? [];

  return {
    company_name: companyRecord?.values.company_name || '',
    company_description: companyRecord?.values.company_description || '',
    brand_voice: brandRecord?.values.brand_voice || '',
    brand_guidelines: brandRecord?.values.brand_guidelines || '',
    products: JSON.stringify(products.map((record) => ({
      id: record.id,
      key: record.key,
      name: record.values.name || '',
      description: record.values.description || '',
      features: record.values.features || '',
      target: record.values.target || '',
      price: record.values.price || '',
      product_url: record.values.product_url || '',
    }))),
  };
}
