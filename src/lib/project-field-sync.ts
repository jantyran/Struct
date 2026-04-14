import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { CustomField, ProjectFieldTemplate, ProjectTypeDefinition } from '@/types';

function normalizeLayout(value: unknown): 'half' | 'full' {
  return value === 'full' ? 'full' : 'half';
}

function parseOptions(value: string | undefined | null) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function deriveFieldState(template: ProjectFieldTemplate, existing?: Partial<CustomField>) {
  const templateOptions = parseOptions(template.options);
  const existingOptions = parseOptions(existing?.options);
  const existingValue = existing?.value ?? '';

  if (template.type === 'reference') {
    const nextReferenceObjectId = String(templateOptions.referenceObjectId || existingOptions.referenceObjectId || '');
    const sameReferenceObject = nextReferenceObjectId === String(existingOptions.referenceObjectId || '');
    return {
      value: sameReferenceObject ? existingValue : '',
      options: JSON.stringify({
        referenceObjectId: nextReferenceObjectId,
        referenceRecordKey: sameReferenceObject ? (existingOptions.referenceRecordKey || '') : '',
      }),
    };
  }

  if (template.type === 'reference_multi') {
    const nextReferenceObjectId = String(templateOptions.referenceObjectId || existingOptions.referenceObjectId || '');
    const sameReferenceObject = nextReferenceObjectId === String(existingOptions.referenceObjectId || '');
    return {
      value: sameReferenceObject ? existingValue : '',
      options: JSON.stringify({
        referenceObjectId: nextReferenceObjectId,
        referenceRecordKeys: sameReferenceObject && Array.isArray(existingOptions.referenceRecordKeys) ? existingOptions.referenceRecordKeys : [],
      }),
    };
  }

  if (template.type === 'select') {
    const choices = Array.isArray(templateOptions.choices) ? templateOptions.choices : [];
    return {
      value: choices.includes(existingValue) ? existingValue : '',
      options: JSON.stringify({ choices }),
    };
  }

  return {
    value: existingValue,
    options: template.options ?? '{}',
  };
}

function toCustomFieldRecord(projectId: string, template: ProjectFieldTemplate, valueSeed?: Partial<CustomField>, sortOrder = 0): CustomField {
  const derivedState = deriveFieldState(template, valueSeed);
  return {
    id: valueSeed?.id || uuidv4(),
    project_id: projectId,
    template_id: template.id,
    key: template.key,
    label: template.label,
    type: template.type,
    value: derivedState.value,
    options: derivedState.options,
    layout: normalizeLayout(template.layout),
    inherited: valueSeed?.inherited ?? 0,
    inherited_from: valueSeed?.inherited_from ?? null,
    crawled_content: valueSeed?.crawled_content ?? null,
    sort_order: sortOrder,
    is_builtin: template.is_builtin ? 1 : 0,
    section: typeof template.section === 'string' ? template.section : '',
  };
}

function matchExistingField(template: ProjectFieldTemplate, existingFields: CustomField[]): CustomField | undefined {
  return (
    existingFields.find((field) => field.template_id === template.id) ||
    existingFields.find((field) => field.key === template.key) ||
    existingFields.find((field) => field.label === template.label)
  );
}

export function syncCustomFieldsWithDefinition(projectId: string, existingFields: CustomField[], definition: ProjectTypeDefinition | null | undefined): CustomField[] {
  if (!definition) {
    return existingFields
      .map((field, index) => ({
        ...field,
        project_id: projectId,
        layout: normalizeLayout(field.layout),
        sort_order: field.sort_order ?? index,
        is_builtin: field.is_builtin ?? 0,
        section: field.section ?? '',
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  return definition.field_templates.map((template, index) => {
    const matched = matchExistingField(template, existingFields);
    return toCustomFieldRecord(projectId, template, matched, index);
  });
}

export function persistProjectCustomFields(db: Database.Database, projectId: string, fields: CustomField[]) {
  db.prepare('DELETE FROM custom_fields WHERE project_id = ?').run(projectId);

  for (const field of fields) {
    db.prepare(`
      INSERT INTO custom_fields (id, project_id, template_id, key, label, type, value, options, layout, inherited, inherited_from, crawled_content, sort_order, is_builtin, section)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      field.id,
      projectId,
      field.template_id ?? null,
      field.key,
      field.label,
      field.type,
      field.value ?? '',
      field.options ?? '{}',
      normalizeLayout(field.layout),
      field.inherited ?? 0,
      field.inherited_from ?? null,
      field.crawled_content ?? null,
      field.sort_order ?? 0,
      field.is_builtin ?? 0,
      field.section ?? ''
    );
  }
}
