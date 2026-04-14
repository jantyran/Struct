import type { GlobalAssets, GlobalAssetField, GlobalAssetFieldType, GlobalAssetObject, GlobalAssetRecord } from '@/types';

const DEFAULT_OBJECTS: GlobalAssetObject[] = [
  {
    id: 'company-profile',
    key: 'company-profile',
    name: '会社情報',
    description: '全プロジェクト共通で使う企業プロフィールです。',
    is_default: true,
    fields: [
      { id: 'company-name', key: 'company_name', label: '会社名', type: 'text' },
      { id: 'company-description', key: 'company_description', label: '会社概要', type: 'textarea' },
    ],
    records: [{ id: 'company-profile-record', name: '会社情報', key: 'company_profile', values: { company_name: '', company_description: '' } }],
  },
  {
    id: 'brand-guidelines',
    key: 'brand-guidelines',
    name: 'ブランド定義',
    description: 'ブランドボイスや表現上のルールを管理します。',
    is_default: true,
    fields: [
      { id: 'brand-voice', key: 'brand_voice', label: 'ブランドボイス', type: 'textarea' },
      { id: 'brand-guidelines-field', key: 'brand_guidelines', label: 'ブランドガイドライン', type: 'textarea' },
    ],
    records: [{ id: 'brand-guidelines-record', name: 'ブランド定義', key: 'brand_guidelines', values: { brand_voice: '', brand_guidelines: '' } }],
  },
  {
    id: 'products-services',
    key: 'products-services',
    name: '製品・サービス',
    description: '提供中の製品やサービスを整理する既定オブジェクトです。',
    is_default: true,
    fields: [
      { id: 'product-name', key: 'name', label: '名称', type: 'text' },
      { id: 'product-description', key: 'description', label: '概要', type: 'textarea' },
      { id: 'product-features', key: 'features', label: '機能・特徴', type: 'textarea' },
      { id: 'product-price', key: 'price', label: '価格', type: 'text' },
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

function legacyObjectsFromRow(row: any): GlobalAssetObject[] {
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
        company_name: row?.company_name || '',
        company_description: row?.company_description || '',
      },
    },
  ];

  brandObject.records = [
    {
      id: 'brand-guidelines-record',
      name: 'ブランド定義',
      key: 'brand_guidelines',
      values: {
        brand_voice: row?.brand_voice || '',
        brand_guidelines: row?.brand_guidelines || '',
      },
    },
  ];

  const products = safeArray<any>(safeJson<any[]>(row?.products, []));
  productsObject.records = products.map((product, index) => ({
    id: product?.id || `product-${index + 1}`,
    name: product?.name || `製品・サービス ${index + 1}`,
    key: product?.key || `products_services_${index + 1}`,
    values: {
      name: product?.name || '',
      description: product?.description || '',
      features: product?.features || '',
      price: product?.price || '',
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

export function normalizeGlobalAssetsRow(row: any): GlobalAssets {
  const objects = row?.objects
    ? normalizeGlobalAssets({ objects: safeJson<GlobalAssetObject[]>(row.objects, []), updated_at: row.updated_at }).objects
    : legacyObjectsFromRow(row);

  return {
    objects,
    updated_at: row?.updated_at || '',
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
      price: record.values.price || '',
    }))),
  };
}
